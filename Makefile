# NUCash Deployment Makefile

.PHONY: deploy-aws deploy-aws-full deploy-local help

# Deploy to AWS server (server only)
deploy-aws:
	@echo "🚀 Deploying to AWS..."
	./deploy-aws.sh

# Advanced deployment to AWS with error checking (server only)
deploy-aws-advanced:
	@echo "🚀 Advanced deployment to AWS..."
	./deploy-aws-advanced.sh

# Full deployment to AWS (includes client build)
deploy-aws-full:
	@echo "🚀 Full deployment to AWS (including client build)..."
	./deploy-aws-full.sh

# Quick local server restart
restart-local:
	@echo "🔄 Restarting local server..."
	cd server && pkill -f "node server.js" || true && npm start

# Help
help:
	@echo "📋 Available commands:"
	@echo "  make deploy-aws         - Deploy to AWS server (server only)"
	@echo "  make deploy-aws-advanced - Advanced deployment to AWS with error checking"
	@echo "  make deploy-aws-full    - Full deployment including client build"
	@echo "  make restart-local      - Restart local server"
	@echo "  make help               - Show this help message"
