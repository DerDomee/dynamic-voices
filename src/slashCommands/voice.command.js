const { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandUserOption, SlashCommandStringOption } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const wait = require('util').promisify(setTimeout);
const { logger } = require('../logger');
const { DynamicVoiceChannel } = require('../database/models/dynamic_voice_channel.model');

const hasChannelPerms = (member, dynChannel) => {
	if (member.roles.cache.has(dynChannel.positive_accessrole_snowflake)) return true;
	return isInChannel(member, dynChannel);
};

const isInChannel = (member, dynChannel) => {
	if (member.voice?.channel?.id == dynChannel.voice_channel_snowflake) return true;
	return false;
};


module.exports = {
	commandData: new SlashCommandBuilder()
		.setName('voice')
		.setDescription('Control the dynamic voice channel you currently own, if any')
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('invite')
			.setDescription('Invite a user to your channel')
			.addUserOption(new SlashCommandUserOption()
				.setName('user')
				.setDescription('Which user do you want to kick?')
				.setRequired(true)))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('kick')
			.setDescription('Kick a user from your channel and revoke their invite')
			.addUserOption(new SlashCommandUserOption()
				.setName('user')
				.setDescription('Which user do you want to kick?')
				.setRequired(true)))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('transfer')
			.setDescription('Transfer the channel ownership to another user')
			.addUserOption(new SlashCommandUserOption()
				.setName('user')
				.setDescription('Which user should own the channel now?')
				.setRequired(true)))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('rename')
			.setDescription('Rename your voice channel to give it your own flair')
			.addStringOption(new SlashCommandStringOption()
				.setName('name')
				.setDescription('New name of your channel')
				.setRequired(true)))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('togglevisibility')
			.setDescription('Toggles channel visibility between public and invite-only'))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('inviteall')
			.setDescription('Enables every connected member to invite new members'))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('archive')
			.setDescription('When the voice channel closes via command or channel leave, the text-channel doesn\'t get deleted.'))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('info')
			.setDescription('Get info about your current voice channel'))
		.addSubcommand(new SlashCommandSubcommandBuilder()
			.setName('close')
			.setDescription('Close and delete your voice channel'))
		.toJSON(),

	commandExecutor: async (interaction) => {
		if (interaction.commandName !== 'voice') {
			logger.error(`Interaction '${interaction.commandName}' got thrown into handler for 'voice'!`);
			logger.error(Error().stack);
		}
		const subcommand = interaction.options.getSubcommand();


		if (subcommand === 'invite') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const invitedMember = interaction.options.getMember('user');
			if ((currentDynChannel.inviteall_activated && hasChannelPerms(interaction.member, currentDynChannel)) || (!currentDynChannel.inviteall_activated && currentOwnerId == memberId)) {
				try {
					await invitedMember.roles.add(await interaction.guild.roles.fetch(currentDynChannel.positive_accessrole_snowflake));
					await interaction.editReply({
						content:`Successfully invited ${invitedMember} to this channel!`,
						allowedMentions: { users:[invitedMember.id] },
					});
				}
				catch(err) {
					await interaction.editReply(`Unable to invite ${invitedMember} to this channel. ||Please report this to a moderator if this keeps happening.||`);
					logger.warn(err);
					logger.warn(err.stack);
				}
				return;
			}
			else {
				await interaction.editReply('You have no permission to invite new member to this channel.');
				return;
			}

		}

		else if (subcommand === 'kick') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const kickedMember = interaction.options.getMember('user');
			if (kickedMember.id == memberId) {
				await interaction.editReply('You can not kick yourself.');
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply('Only the owner can kick other members from this channel!');
				return;
			}
			if (!hasChannelPerms(kickedMember, currentDynChannel)) {
				await interaction.editReply(`${kickedMember} is not part of this channel!`);
				return;
			}
			try {
				await kickedMember.roles.remove(currentDynChannel.positive_accessrole_snowflake);
				await kickedMember.voice.disconnect();
				const extraText = currentDynChannel.is_channel_private ? '!' : ', but they can join again as this channel has public visibility!';
				await interaction.editReply(`Successfully kicked ${kickedMember} from this channel${extraText}`);
			}
			catch(err) {
				await interaction.editReply(`Unable to kick ${kickedMember} from this channel. ||Please report this to a moderator if this keeps happening.||`);
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		}

		else if (subcommand === 'transfer') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const transferredMember = interaction.options.getMember('user');
			if (transferredMember.id == memberId) {
				await interaction.editReply('You can not transfer ownership to yourself.');
				return;
			}
			if (!isInChannel(transferredMember, currentDynChannel)) {
				await interaction.editReply(`${transferredMember} is not currently connected to this channel.`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply('You can only transfer ownership if you are the current owner!');
				return;
			}
			await currentDynChannel.update({
				owner_member_snowflake: transferredMember.id,
			});
			await interaction.editReply(`Successfully transferred ownership to ${transferredMember}`);
		}

		else if (subcommand === 'rename') {
			const newname = interaction.options.getString('name');
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() - currentDynChannel.last_edit;
			if (editDelta < 600000) {
				await interaction.editReply(`You need to wait another ${parseInt((600000 - editDelta) / 1000 / 60)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply('You can only rename this channel if you are the owner!');
				return;
			}
			try {
				await (await interaction.guild.channels.fetch(currentDynChannel.voice_channel_snowflake)).setName(newname);
				await (await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake)).setName(newname);
				await (await interaction.guild.roles.fetch(currentDynChannel.positive_accessrole_snowflake)).setName(newname);
				await currentDynChannel.update({
					last_edit: Date.now(),
					is_channel_renamed: true,
				});
				await interaction.editReply(`Successfully renamed this channel to \`${newname}\``);
			}
			catch (err) {
				await interaction.editReply('Unable to rename this channel. ||Please report this to a moderator if this keeps happening.||');
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		}

		else if (subcommand === 'togglevisibility') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() - currentDynChannel.last_edit;
			if (editDelta < 600000) {
				await interaction.editReply(`You need to wait another ${parseInt((600000 - editDelta) / 1000 / 60)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply('You can only toggle this channels visibility if you are the owner!');
				return;
			}
			try {
				const positive_accessrole = await interaction.guild.roles.fetch(currentDynChannel.positive_accessrole_snowflake);
				if (currentDynChannel.is_channel_private) {
					await (await interaction.guild.channels.fetch(currentDynChannel.voice_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined : `Public by ${interaction.member.user.username}`,
						permissionOverwrites: [],
					});
					await (await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined : `Public by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
							{ id: positive_accessrole, allow: ['VIEW_CHANNEL'] },
						],
					});
					await positive_accessrole.setName(currentDynChannel.is_channel_renamed ? positive_accessrole.name : `Public by ${interaction.member.user.username}`);
					await currentDynChannel.update({
						last_edit: Date.now(),
						is_channel_private: false,
					});
					await interaction.editReply('Successfully set this channels visibility to public.');
				}
				else {
					await (await interaction.guild.channels.fetch(currentDynChannel.voice_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined : `Private by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
							{ id: positive_accessrole, allow: ['VIEW_CHANNEL'] },
						],
					});
					await (await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined : `Private by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
							{ id: positive_accessrole, allow: ['VIEW_CHANNEL'] },
						],
					});
					await positive_accessrole.setName(currentDynChannel.is_channel_renamed ? positive_accessrole.name : `Private by ${interaction.member.user.username}`);
					currentDynChannel.lastEdit = Date.now();
					await currentDynChannel.update({
						last_edit: Date.now(),
						is_channel_private: true,
					});
					await interaction.editReply('Successfully set this channels visibility to private.');
				}
			}
			catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		}

		else if (subcommand === 'inviteall') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			if (currentOwnerId != memberId) {
				await interaction.editReply('You can only change this setting if you are the current owner!');
				return;
			}
			if (currentDynChannel.inviteall_activated) {
				await currentDynChannel.update({
					inviteall_activated: false,
				});
				await interaction.editReply('Only the owner can now invite new members to this channel.');
			}
			else {
				await currentDynChannel.update({
					inviteall_activated: true,
				});
				await interaction.editReply('Everyone connected to this channel can now invite new members.');
			}
		}

		else if (subcommand === 'archive') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			if (currentOwnerId != memberId) {
				interaction.editReply('You can only change this setting if you are the current owner!');
				return;
			}
			if (currentDynChannel.should_archive) {
				await currentDynChannel.update({
					should_archive: false,
				});
				await interaction.editReply('This channel will no longer get archived when it closes!');
			}
			else {
				await currentDynChannel.update({
					should_archive: true,
				});
				await interaction.editReply('This channel will now get archived when it closes!');
			}
		}

		else if (subcommand === 'info') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const voice_channel = await interaction.guild.channels.fetch(currentDynChannel.voice_channel_snowflake);
			const text_channel = await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake);
			const owner = await interaction.guild.members.fetch(currentDynChannel.owner_member_snowflake);
			const positive_accessrole = await interaction.guild.roles.fetch(currentDynChannel.positive_accessrole_snowflake);
			const infoEmbed = new MessageEmbed()
				.setColor('#0099ff')
				.setTitle(`${voice_channel.name}`)
				.setDescription('See information about this channel')
				.addFields(
					{ name: 'Current owner', value: `${owner.user}`, inline: true },
					{ name: 'Attached voice channel', value: `${voice_channel}`, inline: true },
					{ name: 'Attached text channel', value: `${text_channel}`, inline: true },
					{ name: 'Access role', value: `${positive_accessrole}`, inline: true },
					{ name: 'Channel visibility', value: `${currentDynChannel.is_channel_private ? '🔒 Private' : '🔓 Public'}`, inline: true },
					{ name: 'Option \'inviteall\'', value: `${currentDynChannel.inviteall_activated ? '✅ Activated' : '❌ Deactivated'}`, inline: true },
					{ name: 'Option \'archive\'', value: `${currentDynChannel.should_archive ? '✅ Activated' : '❌ Deactivated'}`, inline: true },
				);
			await interaction.editReply({ embeds: [infoEmbed] });
		}

		else if (subcommand === 'close') {
			await interaction.deferReply({ ephemeral: true });
			const currentDynChannel = await DynamicVoiceChannel.findOne({ where: {
				guild_snowflake: interaction.guild.id,
				voice_channel_snowflake: interaction.member.voice?.channel?.id ?? 'NULL',
			} });
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			if (currentOwnerId != memberId) {
				await interaction.editReply('Only the owner can close the channel!');
				return;
			}
			await interaction.editReply('Deleting the channel in 10 seconds, so you can still use `/voice archive`.');
			await wait(10000);
			try {
				await currentDynChannel.reload();
				await (await interaction.guild.channels.fetch(currentDynChannel.voice_channel_snowflake)).delete();
				if(currentDynChannel.should_archive) {
					const textChannel = await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake);
					await textChannel.edit({
						name: `archived-by-${(await interaction.guild.members.fetch(currentDynChannel.owner_member_snowflake)).user.username}`,
						permissionOverwrites: [
							{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
							{ id: await interaction.guild.members.fetch(currentDynChannel.owner_member_snowflake), allow: ['VIEW_CHANNEL'] }],
					});
				}
				else {
					await (await interaction.guild.channels.fetch(currentDynChannel.text_channel_snowflake)).delete('Corresponding voice channel is empty');
				}
				await (await interaction.guild.roles.fetch(currentDynChannel.positive_accessrole_snowflake)).delete();
			}
			catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
			await currentDynChannel.destroy();
			return;
		}

		else {
			interaction.reply({ content: 'YIKES!', ephemeral: false });
		}
	},
};
