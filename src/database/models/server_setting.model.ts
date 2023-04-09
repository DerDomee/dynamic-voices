import {
	AllowNull,
	Column,
	DataType,
	Default,
	Model,
	PrimaryKey,
	Table} from 'sequelize-typescript';

@Table
/**
 *
 */
export default class ServerSetting extends Model {
	@PrimaryKey
	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		guild_snowflake: string;

	@PrimaryKey
	@AllowNull(false)
	@Column({
		type: DataType.STRING(64)})
		setting_name: string;

	@AllowNull(true)
	@Column({
		type: DataType.TEXT('long')})
		setting_value: string;
}
