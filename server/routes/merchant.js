// nucash-server/routes/merchant.js
import express from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import { sendReceipt } from '../services/emailService.js';

router.post('/pay', async (req, res) => {
  try {
    const { rfidUId, amount, deviceId, merchantId, pin } = req.body;

    // NOTE: never log PINs (plaintext or hashed) — these lines end up in pm2 logs.
    console.log('💳 Merchant payment request:', { merchantId, amount });

    // Find user
    const user = await User.findOne({ rfidUId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify PIN
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required for merchant payments' });
    }

    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }

    // Validate amount
    const fareAmount = parseFloat(amount);
    if (isNaN(fareAmount) || fareAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Atomic debit — merchants require a non-negative balance, and the guard
    // lives in the query so concurrent payments can never overspend.
    const debited = await User.findOneAndUpdate(
      { _id: user._id, balance: { $gte: fareAmount } },
      { $inc: { balance: -fareAmount } },
      { new: true }
    );

    if (!debited) {
      return res.status(409).json({
        error: 'Insufficient balance - Merchant payments require positive balance'
      });
    }

    const newBalance = debited.balance;
    const previous = newBalance + fareAmount;

    const tx = await Transaction.create({
      transactionId: Transaction.generateTransactionId(),
      transactionType: 'debit',
      amount: fareAmount,
      balance: newBalance,
      status: 'Completed',
      userId: user._id,
      schoolUId: user.schoolUId,
      email: user.email,
      merchantId: merchantId || null
      // Note: merchantId is used for merchant payments, shuttleId is NOT included
    });

    // Get merchant info if merchantId provided
    let merchantName = 'Campus Merchant';
    if (merchantId) {
      const merchant = await Merchant.findOne({ merchantId });
      if (merchant) {
        merchantName = merchant.businessName;
      }
    }

    // Send email receipt
    sendReceipt({
      userEmail: user.email,
      userName: user.fullName,
      fareAmount: fareAmount,
      previousBalance: previous,
      newBalance: newBalance,
      timestamp: tx.createdAt,
      merchantName: merchantName,
      transactionId: tx.transactionId
    }).catch(err => console.error('Email error:', err));

    console.log(`✅ Merchant payment successful: ₱${fareAmount} (${tx.transactionId})`);

    return res.json({
      transactionId: tx._id,
      studentName: user.fullName,
      previousBalance: previous,
      fareAmount: fareAmount,
      newBalance: newBalance,
      timestamp: tx.createdAt
    });
  } catch (e) {
    console.error('Merchant payment error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;