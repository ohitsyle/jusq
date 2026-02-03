// Script to update existing logs to use the new format
// This will migrate old logs to work with the new role-based filtering

import EventLog from './models/EventLog.js';
import mongoose from 'mongoose';

async function migrateLogs() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nucash');
    console.log('🔗 Connected to MongoDB');

    // Get all logs that need migration
    const logs = await EventLog.find({
      $or: [
        { department: { $exists: false } },
        { department: null },
        { targetEntity: { $exists: false } },
        { 'metadata.adminRole': { $exists: true }, department: { $exists: false } }
      ]
    });

    console.log(`📝 Found ${logs.length} logs to migrate`);

    let updated = 0;
    
    for (const log of logs) {
      const updateData = {};
      
      // Extract admin role from metadata
      const adminRole = log.metadata?.adminRole;
      
      // Set department based on admin role
      if (adminRole && !log.department) {
        updateData.department = adminRole;
      }
      
      // Set targetEntity based on metadata or eventType
      if (!log.targetEntity) {
        const targetEntity = log.metadata?.targetEntity || 
                            (log.eventType === 'login' || log.eventType === 'logout' ? 'admin' : null) ||
                            (log.driverId ? 'driver' : null) ||
                            (log.userId ? 'user' : null) ||
                            'admin';
        updateData.targetEntity = targetEntity;
      }
      
      // Copy admin info from metadata to top level
      if (!log.adminId && log.metadata?.adminId) {
        updateData.adminId = log.metadata.adminId;
      }
      
      // Set adminName if not present
      if (!log.adminName && log.metadata?.adminName) {
        updateData.adminName = log.metadata.adminName;
      }
      
      // Update the log if there are changes
      if (Object.keys(updateData).length > 0) {
        await EventLog.updateOne({ _id: log._id }, { $set: updateData });
        updated++;
        
        console.log(`✅ Updated log ${log.eventId}: ${log.eventType} -> department: ${updateData.department || 'none'}`);
      }
    }
    
    console.log(`\n🎉 Migration complete! Updated ${updated} logs`);
    
    // Test the filtering after migration
    console.log('\n🧪 Testing role-based filtering after migration:');
    
    const motorpoolQuery = {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'motorpool' },
        { department: 'motorpool' },
        { targetEntity: { $in: ['driver', 'shuttle', 'route', 'trip', 'phone'] } },
        { eventType: { $in: ['driver_login', 'driver_logout', 'trip_start', 'trip_end', 'route_change', 'refund', 'phone_assigned', 'phone_unassigned'] } },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'motorpool' }
      ]
    };
    
    const motorpoolLogs = await EventLog.find(motorpoolQuery);
    console.log(`🔧 Motorpool admin should now see ${motorpoolLogs.length} logs`);

    const treasuryQuery = {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'treasury' },
        { department: 'treasury' },
        { targetEntity: { $in: ['user', 'transaction'] } },
        { eventType: { $in: ['cash_in', 'registration'] } },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'treasury' }
      ]
    };
    
    const treasuryLogs = await EventLog.find(treasuryQuery);
    console.log(`💰 Treasury admin should now see ${treasuryLogs.length} logs`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateLogs();
