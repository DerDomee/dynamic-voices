import {
	ApplicationCommandData,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChatInputCommandInteraction,
} from 'discord.js';
import {logger} from '../logger';
import {DDCommand} from './_commands';

export default {
	commandData: {
		type: ApplicationCommandType.ChatInput,
		name: 'settings',
		description: 'View and edit settings for this bot in this server',
		dmPermission: false,
		// defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'view',
				description: 'View ALL actively set settings in this server',
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'get',
				description: 'View detailed information on a specific setting',
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: 'key',
						description: 'Then name of the setting to show data of',
						required: true,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'set',
				description: 'Set the value of a specific setting in this server',
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: 'key',
						description: 'Then name of the setting to set',
						required: true,
					},
					{
						type: ApplicationCommandOptionType.String,
						name: 'value',
						description: 'The data to set for this setting',
						required: true,
					},
				],
			},
		],
	} as ApplicationCommandData,

	commandExecutor: async (interaction: ChatInputCommandInteraction) => {
		if (interaction.commandName !== 'settings') {
			logger.error(
				`Interaction '${interaction.commandName}' got thrown into handler ` +
				'for \'settings\'!',
			);
			logger.error(Error().stack);
		}
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'view') {
			await interaction.deferReply({ephemeral: false});

			await interaction.editReply({content: 'NIY'});
		} else if (subcommand === 'get') {
			await interaction.deferReply({ephemeral: false});
			await interaction.editReply({content: 'NIY'});
		} else if (subcommand === 'set') {
			await interaction.deferReply({ephemeral: true});

			await interaction.editReply({content: 'NIY'});
		} else {
			await interaction.reply({content: 'YIKES!', ephemeral: false});
		}
	},
} as DDCommand;
