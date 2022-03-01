const winston = require('winston');

module.exports.logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json(),
	),
	transports: [
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			colorize: false,
			json: false,
			timestamp: true,
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			level: 'verbose',
			colorize: false,
			json: false,
			timestamp: true,
		}),
	],
});

if (
	process.env.NODE_ENV !== 'production'
) {
	module.exports.logger.add(
		new winston.transports.Console({
			format: winston.format.cli(),
			level: 'debug',
			colorize: true,
			json: true,
			timestamp: true,
		}),
	);
}
else {
	module.exports.logger.add(
		new winston.transports.Console({
			format: winston.format.cli(),
			level: 'info',
			colorize: true,
			json: true,
			timestamp: true,
		}),
	);
}
