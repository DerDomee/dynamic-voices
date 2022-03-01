const { Sequelize } = require('sequelize');


let sequelize = null;

if (process.env.NODE_ENV === 'production') {
	sequelize = new Sequelize({
		dialect: 'mysql',
		user: process.env.DD_DBPROD_USER ?? 'no-user-provided',
		password: process.env.DD_DBPROD_PASS ?? 'no-password-provided',
		database: process.env.DD_DBPROD_NAME ?? 'no-database-provided',
		logging: false,

	});

}
else if (process.env.NODE_ENV === 'test') {
	sequelize = new Sequelize('sqlite::memory:', {
		logging: false,
	});
}
else {
	sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: './database.sqlite',
		logging: false,
	});
}

module.exports = {
	sequelizeInstance: sequelize,
};

require('./models/dynamic_voice_channel.model').initModel(sequelize);
