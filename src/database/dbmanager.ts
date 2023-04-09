import {Sequelize} from 'sequelize-typescript';

import DynamicVoiceChannel from './models/dynamic_voice_channel.model';
import ServerSetting from './models/server_setting.model';

export const initSequelize = (): Sequelize => {
	let sequelizeInstance = undefined;
	const models = [DynamicVoiceChannel, ServerSetting];

	if (process.env.NODE_ENV === 'production') {
		sequelizeInstance = new Sequelize({
			dialect: 'mysql',
			logging: false,
			dialectOptions: {
				user: process.env.DD_DBPROD_USER ?? 'no-user-provided',
				password: process.env.DD_DBPROD_PASS ?? 'no-password-provided',
				database: process.env.DD_DBPROD_NAME ?? 'no-database-provided',
			},
			models: models,
		});
	} else {
		sequelizeInstance = new Sequelize({
			dialect: 'sqlite',
			storage: './database.sqlite',
			logging: false,
			models: models,
		});
	}
	return sequelizeInstance;
};
