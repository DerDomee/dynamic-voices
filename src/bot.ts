import dotenv from 'dotenv';
import {logger} from './logger';
import {
	Client,
	InteractionType,
	GatewayIntentBits,
	Interaction,
	CommandInteraction,
	ChannelType,
	PermissionFlagsBits} from 'discord.js';
import {initSequelize} from './database/dbmanager';
import srcCommands from './slashCommands/_commands';
import DynamicVoiceChannel from './database/models/dynamic_voice_channel.model';

dotenv.config();


const client = new Client({
	intents:
		[
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildVoiceStates,
		],
});

const sequelize = initSequelize();

client.on('ready', async () => {
	try {
		await sequelize.authenticate();
		logger.info('Database connection established');
	} catch (err) {
		logger.error(err);
		logger.error(err.stack);
		process.exit(1);
	}
	logger.info('Sync database models via sequelize (safe sync)');

	sequelize.sync();

	const appCommands = await client.application.commands.fetch();
	/* appCommands.forEach(async (command) => {
		await command.delete();
	});*/
	srcCommands.forEach(async (srcCommand) => {
		const appCommand = appCommands.find(
			(appCommand) => appCommand.name === srcCommand.commandData.name);
		if (appCommand) {
			if (appCommand.equals(srcCommand.commandData)) {
				logger.debug(
					`SRC ${srcCommand.commandData.name} -> ${appCommand.id} -> ✅`);
			} else {
				logger.debug(
					`SRC ${srcCommand.commandData.name} -> ${appCommand.id} -> ` +
					`Re-Syncing -> ✅`);
				logger.debug(JSON.stringify(
					(srcCommand.commandData as unknown as any).options, null, 2));
				logger.debug(JSON.stringify(appCommand.options, null, 2));
				await appCommand.edit(srcCommand.commandData);
			}
		} else {
			logger.debug(
				`SRC ${srcCommand.commandData.name} -> null -> Creating -> ✅`);
			await client.application.commands.create(srcCommand.commandData);
		}
	});

	logger.info(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction: Interaction) => {
	if (interaction.type !== InteractionType.ApplicationCommand) return;
	const command: CommandInteraction = interaction;

	logger.verbose(command);
	logger.verbose(command.commandName);
	logger.verbose(command.commandId);
	logger.verbose(command.commandType);

	if (command.commandName === 'voice') {
		await srcCommands[0].commandExecutor(interaction);
	}
});

client.on('voiceStateUpdate', async (oldState, newState) => {
	if (oldState.channel === newState.channel) return;
	logger.verbose(
		`${newState.member.user.username} changed from ${oldState.channel?.name} ` +
		`to ${newState.channel?.name}`);

	// If old channel is a dynamic channel, do dynamic stuff
	let dynamicChannel = null;
	dynamicChannel = await DynamicVoiceChannel.findOne({where: {
		guild_snowflake: oldState.guild.id,
		voice_channel_snowflake: oldState.channel?.id ?? 'NULL',
	}});
	if (dynamicChannel) {
		// If old channel was public dynamic, remove the role from user;
		if (!dynamicChannel.is_channel_private) {
			try {
				await oldState.member.roles.remove(
					await oldState.guild.roles.fetch(
						dynamicChannel.positive_accessrole_snowflake,
					),
				);
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}

		// If old channel is now empty, delete everything
		if (oldState.channel?.members?.size < 1) {
			try {
				await (await oldState.guild.roles.fetch(
					dynamicChannel.positive_accessrole_snowflake)
				).delete('Corresponding voice channel is empty');

				if (dynamicChannel.should_archive) {
					const textChannel = await oldState.guild.channels.fetch(
						dynamicChannel.text_channel_snowflake);
					await textChannel.edit({
						name: `archived-by-${(await oldState.guild.members.fetch(
							dynamicChannel.owner_member_snowflake)).user.username}`,
						permissionOverwrites: [
							{id: oldState.guild.roles.everyone, deny: ['ViewChannel']},
							{id: await oldState.guild.members.fetch(
								dynamicChannel.owner_member_snowflake),
							allow: ['ViewChannel']}],
					});
				} else {
					await (await oldState.guild.channels.fetch(
						dynamicChannel.text_channel_snowflake)).delete(
						'Corresponding voice channel is empty');
				}
				await oldState.channel.delete('This voice channel is empty');

				await dynamicChannel.destroy();
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}


	// If new channel is a dynamic channel, do dynamic stuff

	dynamicChannel = null;
	dynamicChannel = await DynamicVoiceChannel.findOne({where: {
		guild_snowflake: newState.guild.id,
		voice_channel_snowflake: newState.channel?.id ?? 'NULL',
	}});

	if (dynamicChannel) {
		// If new channel is public dynamic, give the user the corresponding role
		try {
			await newState.member.roles.add(
				await newState.guild.roles.fetch(
					dynamicChannel.positive_accessrole_snowflake,
				),
			);
		} catch (err) {
			logger.warn(err);
			logger.warn(err.stack);
		}
	}

	// If new channel is "Create public channel", create a
	// channel and role and move the user
	if (newState.channel?.id ==
			process.env.DD_DISCORD_NEW_PUBLIC_CHANNEL_SNOWFLAKE) {
		const channelParent = newState.channel.parent;
		let newDynamicChannel;
		try {
			// The new role for this dynamic channel
			const newrole = await newState.guild.roles.create({
				name: `Public by ${newState.member.user.username}`,
				mentionable: false,
			});

			// The new voice channel
			const newvc = await newState.guild.channels.create({
				name: `Public by ${newState.member.user.username}`,
				parent: channelParent,
				type: ChannelType.GuildVoice,
			});

			const newtc = await newState.guild.channels.create({
				name: `Public by ${newState.member.user.username}`,
				parent: channelParent,
				type: ChannelType.GuildText,
				permissionOverwrites: [
					{id: newState.guild.roles.everyone, deny: ['ViewChannel']},
					{id: newrole.id, allow: ['ViewChannel']},
				],
			});

			newDynamicChannel = await DynamicVoiceChannel.create({
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
		} catch (err) {
			logger.error(err);
			logger.error(err.stack);
			try {
				// Need to safely delete the channels and
				// role when creating or moving fails
				await (await oldState.guild.roles.fetch(
					newDynamicChannel.positive_accessrole_snowflake)).delete();
				await (await oldState.guild.channels.fetch(
					newDynamicChannel.text_channel_snowflake)).delete();
				await (await oldState.guild.channels.fetch(
					newDynamicChannel.voice_channel_snowflake)).delete();
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}

	// If new channel is "Create private channel",
	// create a channel and role and move the user
	if (newState.channel?.id ==
			process.env.DD_DISCORD_NEW_PRIVATE_CHANNEL_SNOWFLAKE) {
		const channelParent = newState.channel.parent;
		let newDynamicChannel;
		try {
			// The new role for this dynamic channel
			const newrole = await newState.guild.roles.create({
				name: `Private by ${newState.member.user.username}`,
				mentionable: false,
			});

			// The new voice channel, it is only visible with
			// the role you get with an invite
			const newvc = await newState.guild.channels.create({
				name: `Private by ${newState.member.user.username}`,
				type: ChannelType.GuildVoice,
				parent: channelParent,
				permissionOverwrites: [
					{
						id: newState.guild.roles.everyone,
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: newrole,
						allow: [PermissionFlagsBits.ViewChannel],
					},
				],
			});

			// The new text channel, it is only visible with
			// the role you get with an invite
			const newtc = await newState.guild.channels.create({
				name: `Private by ${newState.member.user.username}`,
				type: ChannelType.GuildText,
				parent: channelParent,
				permissionOverwrites: [
					{
						id: newState.guild.roles.everyone,
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{id: newrole, allow: [PermissionFlagsBits.ViewChannel]},
				],
			});

			newDynamicChannel = await DynamicVoiceChannel.create({
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
		} catch (err) {
			logger.error(err);
			logger.error(err.stack);
			try {
				// Need to safely delete the channels and
				// role when creating or moving fails
				await (await oldState.guild.roles.fetch(
					newDynamicChannel.positive_accessrole_snowflake)).delete();
				await (await oldState.guild.channels.fetch(
					newDynamicChannel.text_channel_snowflake)).delete();
				await (await oldState.guild.channels.fetch(
					newDynamicChannel.voice_channel_snowflake)).delete();
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}
});

client.login(process.env.DD_DISCORD_BOT_TOKEN);
