import winston from 'winston';

export const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json(),
	),
	transports: [
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			level: 'verbose',
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
		}),
	);
} else {
	module.exports.logger.add(
		new winston.transports.Console({
			format: winston.format.cli(),
			level: 'info',
		}),
	);
}
