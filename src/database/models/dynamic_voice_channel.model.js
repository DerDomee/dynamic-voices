const { DataTypes, Model } = require('sequelize');

class DynamicVoiceChannel extends Model {}

module.exports = {

	DynamicVoiceChannel,
	initModel: sequelize => {
		DynamicVoiceChannel.init({
			guild_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				primaryKey: true,
				comment: 'Snowflake ID of the guild this dynamic channel is hosted on',
			},
			voice_channel_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				primaryKey: true,
				comment: 'Snowflake ID of the voice channel this dynamic channel points to',
			},
			text_channel_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				comment: 'Snowflake ID of the text channel that is attached to this dynamic channel',
			},
			positive_accessrole_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				comment: 'Snowflake ID of the positive access role, used for access control and invites',
			},
			negative_accessrole_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: true,
				comment: 'Snowflake ID of the negative access role, used for hellbanning single users from a channel',
			},
			owner_member_snowflake: {
				type: DataTypes.STRING(64),
				allowNull: false,
				comment: 'Snowflake ID of the current owner of this dynamic channel',
			},
			is_channel_private: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
				comment: 'If this channel is currently private or not (public then)',
			},
			is_channel_renamed: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
				comment: 'If this channel ever got renamed (Used for anti-spam metrics when changing visibility)',
			},
			last_edit: {
				type: DataTypes.DATE,
				allowNull: true,
				defaultValue: null,
				comment: 'If and when this channel got edited last',
			},
			should_archive: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
				comment: 'If the attached text channel should archive after the dynamic channel closes',
			},
			inviteall_activated: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
				comment: 'If the inviteall option is currently enabled',
			},

		}, { sequelize });
	},

};
