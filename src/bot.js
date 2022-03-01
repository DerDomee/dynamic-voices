const logger = require('./logger').logger;
const ddlib = require('./ddlib');
const { Client, Intents } = require('discord.js');
const { sequelizeInstance } = require('./database/dbmanager');
const { DynamicVoiceChannel } = require('./database/models/dynamic_voice_channel.model');
const client = new Client({
	intents:
		[
			Intents.FLAGS.GUILDS,
			Intents.FLAGS.GUILD_MEMBERS,
			Intents.FLAGS.GUILD_MESSAGES,
			Intents.FLAGS.GUILD_VOICE_STATES,
		],
});

const slashCommands = ddlib.loadSlashCommands();
client.sequelize = sequelizeInstance;

client.on('ready', async () => {
	try {
		await client.sequelize.authenticate();
		logger.info('Database connection established');
	}
	catch(err) {
		logger.error(err);
		logger.error(err.stack);
		process.exit(1);
	}
	logger.info('Sync database models via sequelize (safe sync)');

	client.sequelize.sync();

	const mainGuild = await client.guilds.fetch(process.env.DD_DISCORD_MAIN_GUILD_SNOWFLAKE);
	const oldCommands = await mainGuild.commands.fetch();
	await ddlib.updateRegisteredCommands(mainGuild.commands, oldCommands, slashCommands);

	logger.info(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;
	const slashCommand = slashCommands.get(commandName);
	await slashCommand?.commandExecutor(interaction);

});

client.on('voiceStateUpdate', async (oldState, newState) => {
	if (oldState.channel === newState.channel) return;
	logger.verbose(`${newState.member.user.username} changed from ${oldState.channel?.name} to ${newState.channel?.name}`);

	// If old channel is a dynamic channel, do dynamic stuff
	let dynamicChannel = null;
	dynamicChannel = await DynamicVoiceChannel.findOne({ where: {
		guild_snowflake: oldState.guild.id,
		voice_channel_snowflake: oldState.channel?.id ?? 'NULL',
	} });
	if(dynamicChannel) {

		// If old channel was public dynamic, remove the role from user;
		if(!dynamicChannel.is_channel_private) {
			try {
				await oldState.member.roles.remove(await oldState.guild.roles.fetch(dynamicChannel.positive_accessrole_snowflake));
			}
			catch(err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}

		// If old channel is now empty, delete everything
		if (oldState.channel?.members?.size < 1) {
			try {
				await (await oldState.guild.roles.fetch(dynamicChannel.positive_accessrole_snowflake)).delete('Corresponding voice channel is empty');

				if(!dynamicChannel.should_archive) await (await oldState.guild.channels.fetch(dynamicChannel.text_channel_snowflake)).delete('Corresponding voice channel is empty');
				await oldState.channel.delete('This voice channel is empty');

				await dynamicChannel.destroy();
			}
			catch(err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}


	// If new channel is a dynamic channel, do dynamic stuff

	dynamicChannel = null;
	dynamicChannel = await DynamicVoiceChannel.findOne({ where: {
		guild_snowflake: newState.guild.id,
		voice_channel_snowflake: newState.channel?.id ?? 'NULL',
	} });

	if (dynamicChannel) {
		// If new channel is public dynamic, give the user the corresponding role
		if (!dynamicChannel.is_channel_private) {
			try {
				await newState.member.roles.add(await newState.guild.roles.fetch(dynamicChannel.positive_accessrole_snowflake));
			}
			catch(err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}

	// If new channel is "Create public channel", create a channel and role and move the user
	if (newState.channel?.id == process.env.DD_DISCORD_NEW_PUBLIC_CHANNEL_SNOWFLAKE) {
		const channelParent = newState.channel.parent;
		let newDynamicChannel;
		try {

			// The new role for this dynamic channel
			const newrole = await newState.guild.roles.create({
				name: `Public by ${newState.member.user.username}`,
				mentionable: false,
			});

			// The new voice channel
			const newvc = await newState.guild.channels.create(
				`Public by ${newState.member.user.username}`,
				{ type: 'GUILD_VOICE', parent: channelParent },
			);

			// The new text channel, it is only visible with the role that you get on join
			const newtc = await newState.guild.channels.create(
				`Public by ${newState.member.user.username}`,
				{ parent: channelParent, permissionOverwrites: [
					{ id: newState.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
					{ id: newrole, allow: ['VIEW_CHANNEL'] },
				] },
			);

			await DynamicVoiceChannel.create({
				guild_snowflake: newState.guild.id,
				voice_channel_snowflake: newvc.id,
				text_channel_snowflake: newtc.id,
				positive_accessrole_snowflake: newrole.id,
				owner_member_snowflake: newState.member.id,
				is_channel_private: false,
				is_channel_renamed: false,
				last_edit: Date.now() - 600000,
				should_archive: false,
			});
			await newState.member.voice.setChannel(newvc);
			await newState.member.roles.add(newrole);
		}
		catch (err) {
			logger.error(err);
			logger.error(err.stack);
			try {
				// Need to safely delete the channels and role when creating or moving fails
				await newDynamicChannel.role?.delete();
				await newDynamicChannel.textChannel?.delete();
				await newDynamicChannel.voiceChannel?.delete();
				client.dynamicVoiceChannels.remove(newDynamicChannel.voiceChannel.id);
			}
			catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}

	// If new channel is "Create private channel", create a channel and role and move the user
	if(newState.channel?.id == process.env.DD_DISCORD_NEW_PRIVATE_CHANNEL_SNOWFLAKE) {
		const channelParent = newState.channel.parent;
		let newDynamicChannel;
		try {

			// The new role for this dynamic channel
			const newrole = await newState.guild.roles.create({
				name: `Private by ${newState.member.user.username}`,
				mentionable: false,
			});

			// The new voice channel, it is only visible with the role you get with an invite
			const newvc = await newState.guild.channels.create(
				`Private by ${newState.member.user.username}`,
				{ type: 'GUILD_VOICE', parent: channelParent, permissionOverwrites: [
					{ id: newState.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
					{ id: newrole, allow: ['VIEW_CHANNEL'] },
				] },
			);

			// The new text channel, it is only visible with the role you get with an invite
			const newtc = await newState.guild.channels.create(
				`Private by ${newState.member.user.username}`,
				{ parent: channelParent, permissionOverwrites: [
					{ id: newState.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
					{ id: newrole, allow: ['VIEW_CHANNEL'] },
				] },
			);

			await DynamicVoiceChannel.create({
				guild_snowflake: newState.guild.id,
				voice_channel_snowflake: newvc.id,
				text_channel_snowflake: newtc.id,
				positive_accessrole_snowflake: newrole.id,
				owner_member_snowflake: newState.member.id,
				is_channel_private: true,
				is_channel_renamed: false,
				last_edit: Date.now() - 600000,
				should_archive: false,
			});

			await newState.member.voice.setChannel(newvc);
			await newState.member.roles.add(newrole);
		}
		catch (err) {
			logger.error(err);
			logger.error(err.stack);
			try {
				// Need to safely delete the channels and role when creating or moving fails
				await newDynamicChannel.role?.delete();
				await newDynamicChannel.textChannel?.delete();
				await newDynamicChannel.voiceChannel?.delete();
				client.dynamicVoiceChannels.remove(newDynamicChannel.voiceChannel.id);
			}
			catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}
});

client.login(process.env.DD_DISCORD_BOT_TOKEN);
