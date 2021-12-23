const { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandUserOption, SlashCommandStringOption } = require('@discordjs/builders');
const wait = require('util').promisify(setTimeout);
const { logger } = require('../logger');

const hasChannelPerms = (member, dynChannel) => {
	if (member.roles.cache.has(dynChannel.role.id)) return true;
	return isInChannel(member, dynChannel);
};

const isInChannel = (member, dynChannel) => {
	if (!dynChannel?.voiceChannel) return false;
	if (member.voice?.channelId != dynChannel?.voiceChannel?.id) return false;
	return true;
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
			// TODO: Make use of inviteall setting
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			const invitedMember = interaction.options.getMember('user');
			if (!currentDynChannel) {
				interaction.editReply('You are not connected to a voice channel.');
				return;
			}
			/* if (!currentDynChannel.inviteall && currentOwnerId != memberId) {
				await interaction.editReply('You can only invite new people if you are the owner of the channel you are currently connected to!');
				return;
			}*/
			if ((currentDynChannel.inviteall && hasChannelPerms(interaction.member, currentDynChannel)) || (!currentDynChannel.inviteall && currentOwnerId == memberId)) {
				try {
					await invitedMember.roles.add(currentDynChannel.role);
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
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			const kickedMember = interaction.options.getMember('user');
			if (kickedMember.id == memberId) {
				await interaction.editReply('You can not kick yourself.');
				return;
			}
			if (currentOwnerId == memberId) {
				if (!hasChannelPerms(kickedMember, currentDynChannel)) {
					await interaction.editReply(`${kickedMember} is not part of this channel!`);
					return;
				}
				try {
					await kickedMember.roles.remove(currentDynChannel.role);
					await kickedMember.voice.disconnect();
					const extraText = currentDynChannel.private ? '!' : ', but they can join again as this channel has public visibility!';
					await interaction.editReply(`Successfully kicked ${kickedMember} from this channel${extraText}`);
				}
				catch(err) {
					await interaction.editReply(`Unable to kick ${kickedMember} from this channel. ||Please report this to a moderator if this keeps happening.||`);
					logger.warn(err);
					logger.warn(err.stack);
				}
				return;
			}
			else {
				await interaction.editReply('You can only kick people from a channel you are currently connected to and that you own!');
			}
		}

		else if (subcommand === 'transfer') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
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
			if (currentOwnerId == memberId) {
				currentDynChannel.owner = transferredMember.user;
				await interaction.editReply(`Successfully transferred ownership to ${transferredMember}`);
			}
			else {
				await interaction.editReply('You can only change settings of a channel you are currently connected to and that you own!');
			}
		}

		else if (subcommand === 'rename') {
			const newname = interaction.options.getString('name');
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() - currentDynChannel.lastEdit;
			if (editDelta < 600000) {
				await interaction.editReply(`You need to wait another ${parseInt((600000 - editDelta) / 1000 / 60)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId == memberId) {
				try {
					await currentDynChannel.voiceChannel.setName(newname);
					await currentDynChannel.textChannel.setName(newname);
					await currentDynChannel.role.setName(newname);
					currentDynChannel.lastEdit = Date.now();
					currentDynChannel.renamed = true;
					await interaction.editReply(`Successfully renamed this channel to \`${newname}\``);
				}
				catch (err) {
					await interaction.editReply('Unable to rename this channel. ||Please report this to a moderator if this keeps happening.||');
					logger.warn(err);
					logger.warn(err.stack);
				}
				return;
			}
			else {
				await interaction.editReply('You can only rename something if you are owner of a dynamic voice channel');
			}
		}

		else if (subcommand === 'togglevisibility') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() - currentDynChannel.lastEdit;
			if (editDelta < 600000) {
				await interaction.editReply(`You need to wait another ${parseInt((600000 - editDelta) / 1000 / 60)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId == memberId) {
				try {
					if (currentDynChannel.private) {
						currentDynChannel.private = false;
						await currentDynChannel.voiceChannel.edit({
							name: currentDynChannel.renamed ? undefined : `Public by ${interaction.member.user.username}`,
							permissionOverwrites: [],
						});
						await currentDynChannel.textChannel.edit({
							name: currentDynChannel.renamed ? undefined : `Public by ${interaction.member.user.username}`,
							permissionOverwrites: [
								{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
								{ id: currentDynChannel.role, allow: ['VIEW_CHANNEL'] },
							],
						});
						await currentDynChannel.role.setName(currentDynChannel.renamed ? currentDynChannel.role.name : `Public by ${interaction.member.user.username}`);
						currentDynChannel.lastEdit = Date.now();
						await interaction.editReply('Successfully set this channels visibility to public.');
					}
					else {
						currentDynChannel.private = true;
						await currentDynChannel.voiceChannel.edit({
							name: currentDynChannel.renamed ? undefined : `Private by ${interaction.member.user.username}`,
							permissionOverwrites: [
								{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
								{ id: currentDynChannel.role, allow: ['VIEW_CHANNEL'] },
							],
						});
						await currentDynChannel.textChannel.edit({
							name: currentDynChannel.renamed ? undefined : `Private by ${interaction.member.user.username}`,
							permissionOverwrites: [
								{ id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
								{ id: currentDynChannel.role, allow: ['VIEW_CHANNEL'] },
							],
						});
						await currentDynChannel.role.setName(currentDynChannel.renamed ? currentDynChannel.role.name : `Private by ${interaction.member.user.username}`);
						currentDynChannel.lastEdit = Date.now();
						await interaction.editReply('Successfully set this channels visibility to private.');
					}
				}
				catch (err) {
					logger.warn(err);
					logger.warn(err.stack);
				}
				return;
			}
			else {
				await interaction.editReply('You can only toggle a channel visibility if you are currently connected to it and you own it!');
			}
		}

		else if (subcommand === 'inviteall') {
			await interaction.deferReply({ ephemeral: false });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			if (currentOwnerId == memberId) {
				if (currentDynChannel.inviteall) {
					await interaction.editReply('Only the owner can now invite new members to this channel.');
					currentDynChannel.inviteall = false;
				}
				else {
					await interaction.editReply('Everyone connected to this channel can now invite new members.');
					currentDynChannel.inviteall = true;
				}
			}
			else {
				await interaction.editReply('You can only change settings of a channel you are currently connected to and that you own!');
			}
		}

		else if (subcommand === 'close') {
			await interaction.deferReply({ ephemeral: true });
			const currentDynChannel = interaction.client.dynamicVoiceChannels.get(interaction.member.voice?.channel?.id);
			const currentOwnerId = currentDynChannel?.owner?.id;
			const memberId = interaction.member.user.id;
			if (currentOwnerId == memberId) {
				await wait(500);
				await interaction.editReply('Deleting the channel now...');
				await wait(200);
				try {
					await currentDynChannel.role.delete();
					await currentDynChannel.textChannel.delete();
					await currentDynChannel.voiceChannel.delete();
				}
				catch (err) {
					logger.warn(err);
					logger.warn(err.stack);
				}
				interaction.client.dynamicVoiceChannels.delete(currentDynChannel.voiceChannel.id);
				return;
			}
			else {
				await interaction.editReply('You can only delete channels that you are currently connected to and that you own!');
			}
		}

		else {
			interaction.reply({ content: 'YIKES!', ephemeral: false });
		}
	},
};
