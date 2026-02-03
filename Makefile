# NUCash Deployment Makefile

.PHONY: deploy-aws deploy-local help

# Deploy to AWS server
deploy-aws:
	@echo "🚀 Deploying to AWS..."
	./deploy-aws.sh

# Advanced deployment to AWS with error checking
deploy-aws-advanced:
	@echo "🚀 Advanced deployment to AWS..."
	./deploy-aws-advanced.sh

# Quick local server restart
restart-local:
	@echo "🔄 Restarting local server..."
	cd server && pkill -f "node server.js" || true && npm start

# Help
help:
	@echo "📋 Available commands:"
	@echo "  make deploy-aws         - Deploy to AWS server"
	@echo "  make deploy-aws-advanced - Advanced deployment to AWS with error checking"
	@echo "  make restart-local      - Restart local server"
	@echo "  make help               - Show this help message"
