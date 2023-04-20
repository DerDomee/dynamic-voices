import dotenv from 'dotenv';
import {logger} from './logger';
import {
	Client,
	InteractionType,
	GatewayIntentBits,
	Interaction,
	VoiceState,
	ChannelType} from 'discord.js';
import {initSequelize} from './database/dbmanager';
import srcCommands from './slashCommands/_commands';
import DynamicVoiceChannel from './database/models/dynamic_voice_channel.model';
import ServerSetting from './database/models/server_setting.model';

dotenv.config();


const client = new Client({
	intents:
		[
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMembers,
			GatewayIntentBits.GuildVoiceStates,
		],
});

const sequelize = initSequelize();

client.on('ready', async () => {
	logger.info('Connecting to the database...');
	try {
		await sequelize.authenticate();
		logger.info('Database connection established!');
	} catch (err) {
		logger.error(err);
		logger.error(err.stack);
		process.exit(1);
	}

	logger.info('Sync database models via sequelize (safe sync)...');
	sequelize.sync();
	logger.info('Sync successfull!');

	logger.info('Updating command registry via discord API...');
	const appCommands = await client.application.commands.fetch();
	appCommands.forEach(async (appCommand) => {
		const srcCommand = srcCommands.find(
			(srcCommand) => appCommand.name === srcCommand.commandData.name,
		);

		if (!srcCommand) {
			logger.debug(
				`APP ${appCommand.name} is ${appCommand.id} -> not found anymore in ` +
				`source -> deleting -> ✅`);

			await appCommand.delete();
		}
	});
	srcCommands.forEach(async (srcCommand) => {
		const appCommand = appCommands.find(
			(appCommand) => appCommand.name === srcCommand.commandData.name);
		if (appCommand) {
			if (appCommand.equals(srcCommand.commandData)) {
				logger.debug(
					`SRC ${srcCommand.commandData.name} is ${appCommand.id} -> no ` +
					`changes needed -> ✅`);
			} else {
				logger.debug(
					`SRC ${srcCommand.commandData.name} is ${appCommand.id} -> ` +
					`Re-Syncing -> ✅`);
				await appCommand.edit(srcCommand.commandData);
			}
		} else {
			logger.debug(
				`SRC ${srcCommand.commandData.name} is nonexistant -> Creating -> ✅`);
			await client.application.commands.create(srcCommand.commandData);
		}
	});
	logger.info('Command registry updated successfully!');

	logger.info(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction: Interaction) => {
	if (interaction.type !== InteractionType.ApplicationCommand) return;

	const command = srcCommands.find(
		(el) => el.commandData.name === interaction.commandName);

	await command?.commandExecutor(interaction);
});

client.on('dynamicChannelJoin', async (
	state: VoiceState,
	dynamicChannel: DynamicVoiceChannel,
) => {
	try {
		await state.member.roles.add(
			await state.guild.roles.fetch(
				dynamicChannel.positive_accessrole_snowflake,
			),
		);
	} catch (err) {
		logger.warn(err);
		logger.warn(err.stack);
	}
});

const createPublicDynamicChannel = async (state: VoiceState) => {
	const channelParent = state?.channel?.parent;
	let newDynamicChannel;
	try {
		// The new role for this dynamic channel
		const newrole = await state.guild.roles.create({
			name: `Public by ${state.member.user.username}`,
			mentionable: false,
		});

		// The new voice channel
		const newvc = await state.guild.channels.create({
			name: `Public by ${state.member.user.username}`,
			parent: channelParent,
			type: ChannelType.GuildVoice,
		});
		await newvc.lockPermissions();
		await newvc.permissionOverwrites.edit(
			client.user,
			{
				ViewChannel: true,
			},
		);

		const newtc = await state.guild.channels.create({
			name: `Public by ${state.member.user.username}`,
			parent: channelParent,
			type: ChannelType.GuildText,
		});
		await newtc.lockPermissions();
		await newtc.permissionOverwrites.edit(
			client.user,
			{
				ViewChannel: true,
			},
		);
		await newtc.permissionOverwrites.edit(
			state.guild.roles.everyone,
			{
				ViewChannel: false,
			},
		);
		await newtc.permissionOverwrites.edit(
			newrole,
			{
				ViewChannel: true,
			},
		);

		newDynamicChannel = await DynamicVoiceChannel.create({
			guild_snowflake: state.guild.id,
			voice_channel_snowflake: newvc.id,
			text_channel_snowflake: newtc.id,
			positive_accessrole_snowflake: newrole.id,
			owner_member_snowflake: state.member.id,
			is_channel_private: false,
			is_channel_renamed: false,
			last_edit: Date.now() - 600000,
			should_archive: false,
		});
		await state.member.voice.setChannel(newvc);
		await state.member.roles.add(newrole);
	} catch (err) {
		logger.error(err);
		logger.error(err.stack);
		try {
			// Need to safely delete the channels and
			// role when creating or moving fails
			await (await state.guild.roles.fetch(
				newDynamicChannel.positive_accessrole_snowflake)).delete();
			await (await state.guild.channels.fetch(
				newDynamicChannel.text_channel_snowflake)).delete();
			await (await state.guild.channels.fetch(
				newDynamicChannel.voice_channel_snowflake)).delete();
		} catch (err) {
			logger.warn(err);
			logger.warn(err.stack);
		}
	}
};

const createPrivateDynamicChannel = async (state: VoiceState) => {
	const channelParent = state?.channel?.parent;
	let newDynamicChannel;
	try {
		// The new role for this dynamic channel
		const newrole = await state.guild.roles.create({
			name: `Private by ${state.member.user.username}`,
			mentionable: false,
		});

		// The new voice channel, it is only visible with
		// the role you get with an invite
		const newvc = await state.guild.channels.create({
			name: `Private by ${state.member.user.username}`,
			type: ChannelType.GuildVoice,
			parent: channelParent,
		});
		await newvc.lockPermissions();
		await newvc.permissionOverwrites.edit(
			client.user,
			{
				ViewChannel: true,
			},
		);
		await newvc.permissionOverwrites.edit(
			state.guild.roles.everyone,
			{
				ViewChannel: false,
			},
		);
		await newvc.permissionOverwrites.edit(
			newrole,
			{
				ViewChannel: true,
			},
		);

		// The new text channel, it is only visible with
		// the role you get with an invite
		const newtc = await state.guild.channels.create({
			name: `Private by ${state.member.user.username}`,
			type: ChannelType.GuildText,
			parent: channelParent,
		});
		await newtc.lockPermissions();
		await newtc.permissionOverwrites.edit(
			client.user,
			{
				ViewChannel: true,
			},
		);
		await newtc.permissionOverwrites.edit(
			state.guild.roles.everyone,
			{
				ViewChannel: false,
			},
		);
		await newtc.permissionOverwrites.edit(
			newrole,
			{
				ViewChannel: true,
			},
		);

		newDynamicChannel = await DynamicVoiceChannel.create({
			guild_snowflake: state.guild.id,
			voice_channel_snowflake: newvc.id,
			text_channel_snowflake: newtc.id,
			positive_accessrole_snowflake: newrole.id,
			owner_member_snowflake: state.member.id,
			is_channel_private: true,
			is_channel_renamed: false,
			last_edit: Date.now() - 600000,
			should_archive: false,
		});

		await state.member.voice.setChannel(newvc);
		await state.member.roles.add(newrole);
	} catch (err) {
		logger.error(err);
		logger.error(err.stack);
		try {
			// Need to safely delete the channels and
			// role when creating or moving fails
			await (await state.guild.roles.fetch(
				newDynamicChannel.positive_accessrole_snowflake)).delete();
			await (await state.guild.channels.fetch(
				newDynamicChannel.text_channel_snowflake)).delete();
			await (await state.guild.channels.fetch(
				newDynamicChannel.voice_channel_snowflake)).delete();
		} catch (err) {
			logger.warn(err);
			logger.warn(err.stack);
		}
	}
};


/**
 * Custom Event: voiceChannelJoin
 * When a user joins any voice channel
 */
client.on('voiceChannelJoin', async (
	state: VoiceState,
	dynamicChannel?: DynamicVoiceChannel,
) => {
	if (dynamicChannel) {
		client.emit('dynamicChannelJoin', state, dynamicChannel);
		return;
	}

	// If new channel is "Create public channel", create a
	// channel and role and move the user
	if (state.channel?.id === (await ServerSetting.findOne({
		where: {
			guild_snowflake: state.guild.id,
			setting_name: 'NEW_PUBLIC_VOICECHANNEL',
		},
	}))?.setting_value
	) {
		createPublicDynamicChannel(state);
		return;
	}

	// If new channel is "Create private channel",
	// create a channel and role and move the user
	if (state.channel?.id === (await ServerSetting.findOne({
		where: {
			guild_snowflake: state.guild.id,
			setting_name: 'NEW_PRIVATE_VOICECHANNEL',
		},
	}))?.setting_value
	) {
		createPrivateDynamicChannel(state);
		return;
	}
});

/**
 * Custom Event: dynamicChannelLeave
 * When a user leaves a dynamic channel
 */
client.on('dynamicChannelLeave', async (
	state: VoiceState,
	dynamicChannel: DynamicVoiceChannel,
) => {
	// If old channel was public dynamic, remove the role from user;
	if (!dynamicChannel.is_channel_private) {
		try {
			await state.member.roles.remove(
				await state.guild.roles.fetch(
					dynamicChannel.positive_accessrole_snowflake,
				),
			);
		} catch (err) {
			logger.warn(err);
			logger.warn(err.stack);
		}
	}

	// If old channel is now empty, delete everything
	if (state.channel?.members?.size < 1) {
		try {
			await (await state.guild.roles.fetch(
				dynamicChannel.positive_accessrole_snowflake)
			).delete('Corresponding voice channel is empty');

			if (dynamicChannel.should_archive) {
				const textChannel = await state.guild.channels.fetch(
					dynamicChannel.text_channel_snowflake);
				await textChannel.edit({
					name: `archived-by-${(await state.guild.members.fetch(
						dynamicChannel.owner_member_snowflake)).user.username}`,
					permissionOverwrites: [
						{id: state.guild.roles.everyone, deny: ['ViewChannel']},
						{id: await state.guild.members.fetch(
							dynamicChannel.owner_member_snowflake),
						allow: ['ViewChannel']}],
				});
			} else {
				await (await state.guild.channels.fetch(
					dynamicChannel.text_channel_snowflake)).delete(
					'Corresponding voice channel is empty');
			}
			await state.channel.delete('This voice channel is empty');

			await dynamicChannel.destroy();
		} catch (err) {
			logger.warn(err);
			logger.warn(err.stack);
		}
	}
});

/**
 * Custom Event: voiceChannelLeave
 * When a user leaves any voice channel.
 */
client.on('voiceChannelLeave', async (
	state: VoiceState,
	dynamicChannel?: DynamicVoiceChannel,
) => {
	if (dynamicChannel) client.emit('dynamicChannelLeave', state, dynamicChannel);
});

/**
 * Custom Event: voiceChannelChange
 * When a user switches channel (oldState and newState channels are not equal,
 * but one of them can be null)
 */
client.on('voiceChannelChange', async (oldState: VoiceState, newState) => {
	const oldDynamicChannel = await DynamicVoiceChannel.findOne({where: {
		guild_snowflake: oldState.guild.id,
		voice_channel_snowflake: oldState.channel?.id ?? 'NULL',
	}});
	if (oldState.channel) {
		client.emit('voiceChannelLeave', oldState, oldDynamicChannel);
	}

	const newDynamicChannel = await DynamicVoiceChannel.findOne({where: {
		guild_snowflake: newState.guild.id,
		voice_channel_snowflake: newState.channel?.id ?? 'NULL',
	}});
	if (newState.channel) {
		client.emit('voiceChannelJoin', newState, newDynamicChannel);
	}
});

/**
 * Standard Discord Event: voiceStateUpdate
 * When a user switches channel, mutes or deafens himself,
 * gets muted or deafened, etc.
 */
client.on('voiceStateUpdate', async (oldState: VoiceState, newState) => {
	if (oldState.channel === newState.channel) return;

	logger.verbose(
		`${newState.member.user.username} changed from ${oldState.channel?.name} ` +
		`to ${newState.channel?.name}`);

	client.emit('voiceChannelChange', oldState, newState);
});

client.login(process.env.DD_DISCORD_BOT_TOKEN);
