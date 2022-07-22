import {
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandStringOption,
} from '@discordjs/builders';
import {
	ApplicationCommandData,
	ChatInputCommandInteraction,
} from 'discord.js';
import {logger} from '../logger';
import {DDCommand} from './_commands';

export default {
	commandData: new SlashCommandBuilder()
		.setName('settings')
		.setDescription('View and edit settings for this bot in this server')
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('view')
				.setDescription('Print out ALL current settings and their values'),
		)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('get')
				.setDescription(
					'For a specific setting, print value, time of last change, the ' +
					'user who changed it, and it\'s purpose',
				)
				.addStringOption(
					new SlashCommandStringOption()
						.setName('key')
						.setDescription('Name of the setting-key')
						.setRequired(true),
				),
		)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('set')
				.setDescription('Set the value for a specific setting')
				.addStringOption(
					new SlashCommandStringOption()
						.setName('key')
						.setDescription('Name of the setting-key')
						.setRequired(true),
				)
				.addStringOption(
					new SlashCommandStringOption()
						.setName('value')
						.setDescription('Value of the new setting')
						.setRequired(true),
				),
		)
		.toJSON() as ApplicationCommandData,

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
