const logger = require('./logger').logger;
const ddlib = require('./ddlib');
const { Client, Intents, Collection } = require('discord.js');
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

client.dynamicVoiceChannels = new Collection();

client.on('ready', async () => {
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

	// If old channel was dynamic and is public, remove the role
	if (client.dynamicVoiceChannels.get(oldState.channel?.id)) {
		const dynChannel = client.dynamicVoiceChannels.get(oldState.channel.id);
		if (!dynChannel.private) {
			try {
				await oldState.member.roles.remove(dynChannel.role);
			}
			catch(err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}

	// If old channel is now empty, delete everything
	if (client.dynamicVoiceChannels.get(oldState.channel?.id)) {
		const dynChannel = client.dynamicVoiceChannels.get(oldState.channel.id);
		if (dynChannel.voiceChannel.members.size < 1) {
			try {
				await dynChannel.role.delete('Corresponding voice channel is empty');
				await dynChannel.textChannel.delete('Corresponding voice channel is empty');
				await dynChannel.voiceChannel.delete('This voice channel is empty');
			}
			catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
		}
	}

	// If new channel is dynamic and is public, give the user the corresponding role
	if (client.dynamicVoiceChannels.get(newState.channel?.id)) {
		const dynChannel = client.dynamicVoiceChannels.get(newState.channel.id);
		if (!dynChannel.isPrivate) {
			try {
				await newState.member.roles.add(dynChannel.role);
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

			newDynamicChannel = {
				voiceChannel: newvc,
				textChannel: newtc,
				role: newrole,
				owner: newState.member.user,
				private: false,
				renamed: false,
				inviteall: false,
				lastEdit: Date.now() - 600000,
			};
			await newState.member.voice.setChannel(newvc);
			await newState.member.roles.add(newrole);

			client.dynamicVoiceChannels.set(newvc.id, newDynamicChannel);
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

			newDynamicChannel = {
				voiceChannel: newvc,
				textChannel: newtc,
				role: newrole,
				owner: newState.member.user,
				private: true,
				renamed: false,
				inviteall: false,
				lastEdit: Date.now() - 600000,
			};

			await newState.member.voice.setChannel(newvc);
			await newState.member.roles.add(newrole);

			client.dynamicVoiceChannels.set(newvc.id, newDynamicChannel);
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
