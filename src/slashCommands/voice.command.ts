import {
	ApplicationCommandData,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	EmbedBuilder,
} from 'discord.js';
import {logger} from '../logger';
import DynamicVoiceChannel from
	'../database/models/dynamic_voice_channel.model';
import {DDCommand} from './_commands';

const hasChannelPerms = (member: any, dynChannel: any) => {
	if (member.roles.cache.has(dynChannel.positive_accessrole_snowflake)) {
		return true;
	}
	return isInChannel(member, dynChannel);
};

const isInChannel = (member: any, dynChannel: any) => {
	return member.voice?.channel?.id == dynChannel.voice_channel_snowflake;
};


export default {
	commandData: {
		type: ApplicationCommandType.ChatInput,
		name: 'voice',
		description: 'Control the dynamic voice channel you currently own',
		dmPermission: false,
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'invite',
				description: 'Invite a user to the channel',
				options: [
					{
						type: ApplicationCommandOptionType.User,
						name: 'user',
						description: 'The user to invite to the channel',
						required: true,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'kick',
				description: 'Kick a user from the channel',
				options: [
					{
						type: ApplicationCommandOptionType.User,
						name: 'user',
						description: 'The user to kick from the channel',
						required: true,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'transfer',
				description: 'Transfer the channel ownership to another user',
				options: [
					{
						type: ApplicationCommandOptionType.User,
						name: 'user',
						description: 'The user to transfer the channel to',
						required: true,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'rename',
				description: 'Set the name of the channel',
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: 'name',
						description: 'New name for the channel',
						maxLength: 100,
						required: true,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'togglevisibility',
				description: 'Toggle the channel visibility between public and private',
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'inviteall',
				description: 'Enables every connected member to invite new members',
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'archive',
				description: 'When the voice channel closes via command or channel ' +
					           'leave, the text-channel doesn\'t get deleted.',
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'info',
				description: 'Get info about your current voice channel',
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'close',
				description: 'Close and delete your voice channel',
			},
		],
	} as ApplicationCommandData,


	commandExecutor: async (interaction: any) => {
		if (interaction.commandName !== 'voice') {
			logger.error(`Interaction '${interaction.commandName}' got thrown into ` +
			             `handler for 'voice'!`);
			logger.error(Error().stack);
		}
		const subcommand = interaction.options.getSubcommand();
		await interaction.deferReply({ephemeral: false});

		let currentDynChannel;
		currentDynChannel = await DynamicVoiceChannel.findOne({
			where: {
				guild_snowflake: interaction.guild.id,
				text_channel_snowflake: interaction.channel.id,
			},
		});
		if (!currentDynChannel) {
			currentDynChannel = await DynamicVoiceChannel.findOne({
				where: {
					guild_snowflake: interaction.guild.id,
					voice_channel_snowflake: interaction.member.voice?.channel?.id ??
						'NULL',
				},
			});
		}
		if (!currentDynChannel) {
			interaction.editReply('You are not connected to a voice channel.');
			return;
		}


		if (subcommand === 'invite') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const invitedMember = interaction.options.getMember('user');
			if ((currentDynChannel.inviteall_activated && hasChannelPerms(
				interaction.member, currentDynChannel)) ||
				(!currentDynChannel.inviteall_activated && currentOwnerId == memberId)
			) {
				try {
					const positiveAccessRole = await interaction.guild.roles.fetch(
						currentDynChannel.positive_accessrole_snowflake);
					await invitedMember.roles.add(positiveAccessRole);
					await interaction.editReply({
						content: `Successfully invited ${invitedMember} to this channel!`,
						allowedMentions: {users: [invitedMember.id]},
					});
				} catch (err) {
					await interaction.editReply(
						`Unable to invite ${invitedMember} to this channel. ||Please ` +
						`report this to a moderator if this keeps happening.||`);
					logger.warn(err);
					logger.warn(err.stack);
				}
				return;
			} else {
				await interaction.editReply(
					'You have no permission to invite new member to this channel.');
				return;
			}
		} else if (subcommand === 'kick') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const kickedMember = interaction.options.getMember('user');
			if (kickedMember.id == memberId) {
				await interaction.editReply('You can not kick yourself.');
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply(
					'Only the owner can kick other members from this channel!');
				return;
			}
			if (!hasChannelPerms(kickedMember, currentDynChannel)) {
				await interaction.editReply(
					`${kickedMember} is not part of this channel!`);
				return;
			}
			try {
				await kickedMember.roles.remove(
					currentDynChannel.positive_accessrole_snowflake);
				await kickedMember.voice.disconnect();
				const extraText = currentDynChannel.is_channel_private ? '!' :
					', but they can join again as this channel has public visibility!';
				await interaction.editReply(
					`Successfully kicked ${kickedMember} from this channel${extraText}`);
			} catch (err) {
				await interaction.editReply(
					`Unable to kick ${kickedMember} from this channel. ||Please report` +
					`this to a moderator if this keeps happening.||`);
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		} else if (subcommand === 'transfer') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const transferredMember = interaction.options.getMember('user');
			if (transferredMember.id == memberId) {
				await interaction.editReply(
					'You can not transfer ownership to yourself.');
				return;
			}
			if (!isInChannel(transferredMember, currentDynChannel)) {
				await interaction.editReply(
					`${transferredMember} is not currently connected to this channel.`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply(
					'You can only transfer ownership if you are the current owner!');
				return;
			}
			await currentDynChannel.update({
				owner_member_snowflake: transferredMember.id,
			});
			await interaction.editReply(
				`Successfully transferred ownership to ${transferredMember}`);
		} else if (subcommand === 'rename') {
			const newname = interaction.options.getString('name');

			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() -
				(currentDynChannel.last_edit as unknown as number);
			if (editDelta < 600000) {
				await interaction.editReply(
					`You need to wait another ${parseInt(
						((600000 - editDelta) / 1000 / 60) as unknown as string,
					)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply(
					'You can only rename this channel if you are the owner!');
				return;
			}
			try {
				await (await interaction.guild.channels.fetch(
					currentDynChannel.voice_channel_snowflake)).setName(newname);
				await (await interaction.guild.channels.fetch(
					currentDynChannel.text_channel_snowflake)).setName(newname);
				await (await interaction.guild.roles.fetch(
					currentDynChannel.positive_accessrole_snowflake)).setName(newname);
				await currentDynChannel.update({
					last_edit: Date.now(),
					is_channel_renamed: true,
				});
				await interaction.editReply(
					`Successfully renamed this channel to \`${newname}\``);
			} catch (err) {
				await interaction.editReply(
					'Unable to rename this channel. ||Please report this to a ' +
					'moderator if this keeps happening.||');
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		} else if (subcommand === 'togglevisibility') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			const editDelta = Date.now() - (
				currentDynChannel.last_edit as unknown as number);
			if (editDelta < 600000) {
				await interaction.editReply(
					`You need to wait another ${parseInt(
						((600000 - editDelta) / 1000 / 60) as unknown as string,
					)} minutes until you can edit this channel again!`);
				return;
			}
			if (currentOwnerId != memberId) {
				await interaction.editReply(
					'You can only toggle this channels visibility if you are the owner!');
				return;
			}
			try {
				const positiveAccessrole = await interaction.guild.roles.fetch(
					currentDynChannel.positive_accessrole_snowflake);
				if (currentDynChannel.is_channel_private) {
					await (await interaction.guild.channels.fetch(
						currentDynChannel.voice_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined :
							`Public by ${interaction.member.user.username}`,
						permissionOverwrites: [],
					});
					await (await interaction.guild.channels.fetch(
						currentDynChannel.text_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined :
							`Public by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL']},
							{id: positiveAccessrole, allow: ['VIEW_CHANNEL']},
						],
					});
					await positiveAccessrole.setName(
						currentDynChannel.is_channel_renamed ? positiveAccessrole.name :
							`Public by ${interaction.member.user.username}`);
					await currentDynChannel.update({
						last_edit: Date.now(),
						is_channel_private: false,
					});
					await interaction.editReply(
						'Successfully set this channels visibility to public.');
				} else {
					await (await interaction.guild.channels.fetch(
						currentDynChannel.voice_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined :
							`Private by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL']},
							{id: positiveAccessrole, allow: ['VIEW_CHANNEL']},
						],
					});
					await (await interaction.guild.channels.fetch(
						currentDynChannel.text_channel_snowflake)).edit({
						name: currentDynChannel.is_channel_renamed ? undefined :
							`Private by ${interaction.member.user.username}`,
						permissionOverwrites: [
							{id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL']},
							{id: positiveAccessrole, allow: ['VIEW_CHANNEL']},
						],
					});
					await positiveAccessrole.setName(
						currentDynChannel.is_channel_renamed ? positiveAccessrole.name :
							`Private by ${interaction.member.user.username}`);
					currentDynChannel.last_edit = Date.now() as unknown as Date;
					await currentDynChannel.update({
						last_edit: Date.now(),
						is_channel_private: true,
					});
					await interaction.editReply(
						'Successfully set this channels visibility to private.');
				}
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
			return;
		} else if (subcommand === 'inviteall') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			if (currentOwnerId != memberId) {
				await interaction.editReply(
					'You can only change this setting if you are the current owner!');
				return;
			}
			if (currentDynChannel.inviteall_activated) {
				await currentDynChannel.update({
					inviteall_activated: false,
				});
				await interaction.editReply(
					'Only the owner can now invite new members to this channel.');
			} else {
				await currentDynChannel.update({
					inviteall_activated: true,
				});
				await interaction.editReply(
					'Everyone connected to this channel can now invite new members.');
			}
		} else if (subcommand === 'archive') {
			const currentOwnerId = currentDynChannel.owner_member_snowflake;
			const memberId = interaction.member.user.id;
			if (currentOwnerId != memberId) {
				interaction.editReply(
					'You can only change this setting if you are the current owner!');
				return;
			}
			if (currentDynChannel.should_archive) {
				await currentDynChannel.update({
					should_archive: false,
				});
				await interaction.editReply(
					'This channel will no longer get archived when it closes!');
			} else {
				await currentDynChannel.update({
					should_archive: true,
				});
				await interaction.editReply(
					'This channel will now get archived when it closes!');
			}
		} else if (subcommand === 'info') {
			const voiceChannel = await interaction.guild.channels.fetch(
				currentDynChannel.voice_channel_snowflake);
			const textChannel = await interaction.guild.channels.fetch(
				currentDynChannel.text_channel_snowflake);
			const owner = await interaction.guild.members.fetch(
				currentDynChannel.owner_member_snowflake);
			const positiveAccessrole = await interaction.guild.roles.fetch(
				currentDynChannel.positive_accessrole_snowflake);
			const infoEmbed = new EmbedBuilder()
				.setColor('#0099ff')
				.setTitle(`${voiceChannel.name}`)
				.setDescription('See information about this channel')
				.addFields(
					{
						name: 'Current owner',
						value: `${owner.user}`,
						inline: true,
					},
					{
						name: 'Attached voice channel',
						value: `${voiceChannel}`,
						inline: true,
					},
					{
						name: 'Attached text channel',
						value: `${textChannel}`,
						inline: true},
					{
						name: 'Access role',
						value: `${positiveAccessrole}`,
						inline: true,
					},
					{
						name: 'Channel visibility',
						value: `${currentDynChannel.is_channel_private ? '🔒 Private' :
							'🔓 Public'}`,
						inline: true,
					},
					{
						name: 'Option \'inviteall\'',
						value: `${currentDynChannel.inviteall_activated ? '✅ Activated' :
							'❌ Deactivated'}`,
						inline: true,
					},
					{
						name: 'Option \'archive\'',
						value: `${currentDynChannel.should_archive ? '✅ Activated' :
							'❌ Deactivated'}`,
						inline: true,
					},
				);
			await interaction.editReply({embeds: [infoEmbed]});
		} else if (subcommand === 'close') {
			try {
				await currentDynChannel.reload();
				await (await interaction.guild.channels.fetch(
					currentDynChannel.voice_channel_snowflake)).delete();
				if (currentDynChannel.should_archive) {
					const textChannel = await interaction.guild.channels.fetch(
						currentDynChannel.text_channel_snowflake);
					await textChannel.edit({
						name: `archived-by-${(await interaction.guild.members.fetch(
							currentDynChannel.owner_member_snowflake)).user.username}`,
						permissionOverwrites: [
							{id: interaction.guild.roles.everyone, deny: ['VIEW_CHANNEL']},
							{id: await interaction.guild.members.fetch(
								currentDynChannel.owner_member_snowflake),
							allow: ['VIEW_CHANNEL']}],
					});
				} else {
					await (await interaction.guild.channels.fetch(
						currentDynChannel.text_channel_snowflake)).delete(
						'Corresponding voice channel is empty');
				}
				await (await interaction.guild.roles.fetch(
					currentDynChannel.positive_accessrole_snowflake)).delete();
			} catch (err) {
				logger.warn(err);
				logger.warn(err.stack);
			}
			await currentDynChannel.destroy();
			return;
		} else {
			interaction.reply({content: 'YIKES!', ephemeral: false});
		}
	},
} as DDCommand;
