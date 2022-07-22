const {DataTypes, Model} = require('sequelize');

class ServerSetting extends Model {}

module.exports = {

	ServerSetting,
	initModel: (sequelize) => {
		ServerSetting.init({
			guild_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				primaryKey: true,
				comment: 'Snowflake ID of the guild this setting is applied on',
			},
			setting_name: {
				type: DataTypes.STRING(64),
				allowNull: false,
				primaryKey: true,
				comment: 'The keyname of the setting',
			},
			setting_value: {
				type: DataTypes.TEXT,
				allowNull: false,
				comment: 'The value of the setting',
			},
			last_changed_by: {
				type: DataTypes.STRING(64),
				allowNull: false,
				comment: 'Snowflake ID of the member who most recently changed this setting',
			},
			last_changed_at: {
				type: DataTypes.DATE,
				allowNull: false,
				comment: 'Time of last change of this setting',
			},

		}, {sequelize});
	},
	knownSettings: [
		{
			displayname: '"New Public Voice" channel',
			setting_name: 'new_publicvoice_snowflake',
			default_value: null,
			type: 'Voice channel snowflake',
		},
		{
			displayname: '"New Private Voice" channel',
			setting_name: 'new_privatevoice_snowflake',
			default_value: null,
			type: 'Voice channel snowflake',
		},
		{
			displayname: 'Moderator role',
			setting_name: 'moderator_role_snowflake',
			default_value: null,
			type: 'Role snowflake',
		},
		{
			displayname: 'Serverwide Textmute role',
			setting_name: 'textmute_role_snowflake',
			default_value: null,
			type: 'Role snowflake',
		},
		{
			displayname: 'Serverwide Voicemute role',
			setting_name: 'voicemute_role_snowflake',
			default_value: null,
			type: 'Role snowflake',
		},
	],

};
