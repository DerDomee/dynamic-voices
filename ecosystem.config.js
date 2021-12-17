module.exports = {
	apps: [
		{
			name: 'dcjs-moderation',
			script: 'npm start',
			error_file: 'logs/error.log',
			out_file: 'logs/out.log',
			log_file: 'logs/combined.log',
			env: {
				NODE_ENV: 'development',
				RESTART_MODE: 'TRUE',
			},
			env_production: {
				NODE_ENV: 'production',
				RESTART_MODE: 'TRUE',
			},
		},
	],
};
