import type * as MYSQL from "mysql2";
import { ConnectionOptions } from "typeorm";
import * as TypeormDriver from "typeorm/driver/mysql/MysqlDriver";
import { DataTypeDefaults } from "typeorm/driver/types/DataTypeDefaults";
import * as TomgUtils from "../Utils";
import AbstractDriver from "./AbstractDriver";
import IConnectionOptions from "../IConnectionOptions";
import { Entity } from "../models/Entity";
import { Column } from "../models/Column";
import { Index } from "../models/Index";
import { RelationInternal } from "../models/RelationInternal";
import IGenerationOptions from "../IGenerationOptions";

export default class MysqlDriver extends AbstractDriver {
    public defaultValues: DataTypeDefaults = new TypeormDriver.MysqlDriver({
        options: { replication: undefined } as ConnectionOptions,
    } as any).dataTypeDefaults;

    public readonly EngineName: string = "MySQL";

    public readonly standardPort = 3306;

    public readonly standardUser = "root";

    public readonly standardSchema = "";

    private MYSQL: typeof MYSQL;

    private Connection: MYSQL.Connection;

    public constructor() {
        super();
        try {
            // eslint-disable-next-line import/no-extraneous-dependencies, global-require, import/no-unresolved
            this.MYSQL = require("mysql2");
        } catch (error) {
            TomgUtils.LogError("", false, error);
            throw error;
        }
    }

    public async GetAllTables(
        schemas: string[],
        dbNames: string[]
    ): Promise<Entity[]> {
        const response: {
            TABLE_SCHEMA: string;
            TABLE_NAME: string;
            DB_NAME: string;
        }[] = await this.ExecQuery(
            `SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_SCHEMA as DB_NAME
                        FROM information_schema.tables
                        WHERE table_type='BASE TABLE'
                        AND table_schema IN (${MysqlDriver.buildEscapedObjectList(
                            dbNames
                        )})`
        );
        // const response = await this.GetAllTablesQuery(schemas, dbNames);
        const ret: Entity[] = [] as Entity[];
        response.forEach((val) => {
            ret.push({
                columns: [],
                indices: [],
                relations: [],
                relationIds: [],
                sqlName: val.TABLE_NAME,
                tscName: val.TABLE_NAME,
                fileName: val.TABLE_NAME,
                database: dbNames.length > 1 ? val.DB_NAME : "",
                schema: val.TABLE_SCHEMA,
                fileImports: [],
            });
        });
        return ret;
    }

    public async GetCoulmnsFromEntity(
        entities: Entity[],
        schemas: string[],
        dbNames: string[]
    ): Promise<Entity[]> {
        const response = await this.ExecQuery<{
            TABLE_NAME: string;
            COLUMN_NAME: string;
            COLUMN_DEFAULT: string;
            IS_NULLABLE: string;
            DATA_TYPE: string;
            CHARACTER_MAXIMUM_LENGTH: number;
            NUMERIC_PRECISION: number | null;
            NUMERIC_SCALE: number | null;
            IsIdentity: number;
            COLUMN_TYPE: string;
            COLUMN_KEY: string;
            COLUMN_COMMENT: string;
            REFERENCED_TABLE_NAME: string;
        }>(`SELECT  C.TABLE_NAME,
                    C.COLUMN_NAME,
                    C.COLUMN_DEFAULT,
                    C.IS_NULLABLE,
                    C.DATA_TYPE,
                    C.CHARACTER_MAXIMUM_LENGTH,
                    C.NUMERIC_PRECISION,
                    C.NUMERIC_SCALE,
                    CASE WHEN C.EXTRA like '%auto_increment%' THEN 1 ELSE 0 END IsIdentity,
                    C.COLUMN_TYPE,
                    C.COLUMN_KEY,
                    C.COLUMN_COMMENT,
                    KCU.REFERENCED_TABLE_NAME
            FROM INFORMATION_SCHEMA.COLUMNS C
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU
              ON C.TABLE_NAME = KCU.TABLE_NAME
             AND C.COLUMN_NAME = KCU.COLUMN_NAME
             AND C.TABLE_SCHEMA = KCU.TABLE_SCHEMA
             AND KCU.REFERENCED_TABLE_NAME is not null
             AND KCU.REFERENCED_COLUMN_NAME is not null
            WHERE C.TABLE_SCHEMA IN (${MysqlDriver.buildEscapedObjectList(
                dbNames
            )})
			ORDER BY C.ORDINAL_POSITION`);
        entities.forEach((ent) => {
            response
                .filter((filterVal) => filterVal.TABLE_NAME === ent.tscName)
                .forEach((resp) => {
                    const tscName = resp.COLUMN_NAME;
                    let tscType = "";
                    const options: Column["options"] = {
                        name: resp.COLUMN_NAME,
                    };
                    const generated = resp.IsIdentity === 1 ? true : undefined;
                    const defaultValue = MysqlDriver.ReturnDefaultValueFunction(
                        resp.COLUMN_DEFAULT,
                        resp.DATA_TYPE
                    );
                    let transformer;

                    // cannot add tranformer on auto-increment column
                    if (!generated) {
                        transformer = MysqlDriver.ReturnDatatypeTransformer(
                            resp.DATA_TYPE,
                            resp.COLUMN_TYPE,
                            ent.generateTinyintTransformer,
                            ent.generateBigintTransformer
                        );
                    }
                    let columnType = resp.DATA_TYPE;
                    if (resp.IS_NULLABLE === "YES") options.nullable = true;
                    if (resp.COLUMN_KEY === "UNI") options.unique = true;
                    if (resp.COLUMN_COMMENT)
                        options.comment = resp.COLUMN_COMMENT;
                    if (resp.COLUMN_TYPE.endsWith(" unsigned"))
                        options.unsigned = true;
                    switch (resp.DATA_TYPE) {
                        case "int":
                            tscType = "number";
                            break;
                        case "bit":
                            if (resp.COLUMN_TYPE === "bit(1)") {
                                tscType = "boolean";
                            } else {
                                tscType = "number";
                            }
                            break;
                        case "tinyint":
                            if (
                                !generated && // generated columns do not support transforms
                                ent.generateTinyintTransformer &&
                                (resp.COLUMN_TYPE === "tinyint(1)" ||
                                    resp.COLUMN_TYPE === "tinyint(1) unsigned")
                            ) {
                                options.width = 1;
                                tscType = "boolean";
                            } else {
                                tscType = "number";
                            }
                            break;
                        case "smallint":
                            tscType = "number";
                            break;
                        case "mediumint":
                            tscType = "number";
                            break;
                        case "bigint":
                            // generated columns do not support transforms
                            if (!generated && ent.generateBigintTransformer) {
                                tscType = "number";
                            } else {
                                tscType = "string";
                            }
                            break;
                        case "float":
                            tscType = "number";
                            break;
                        case "double":
                            tscType = "number";
                            break;
                        case "decimal":
                            tscType = "string";
                            break;
                        case "date":
                            tscType = "string";
                            break;
                        case "datetime":
                            tscType = "Date";
                            break;
                        case "timestamp":
                            tscType = "Date";
                            break;
                        case "time":
                            tscType = "string";
                            break;
                        case "year":
                            tscType = "number";
                            break;
                        case "char":
                            tscType = "string";
                            break;
                        case "varchar":
                            tscType = "string";
                            break;
                        case "blob":
                            tscType = "Buffer";
                            break;
                        case "text":
                            tscType = "string";
                            break;
                        case "tinyblob":
                            tscType = "Buffer";
                            break;
                        case "tinytext":
                            tscType = "string";
                            break;
                        case "mediumblob":
                            tscType = "Buffer";
                            break;
                        case "mediumtext":
                            tscType = "string";
                            break;
                        case "longblob":
                            tscType = "Buffer";
                            break;
                        case "longtext":
                            tscType = "string";
                            break;
                        case "enum":
                            tscType = resp.COLUMN_TYPE.substring(
                                5,
                                resp.COLUMN_TYPE.length - 1
                            )
                                .replace(/'/gi, '"')
                                .replace(/","/gi, '" | "');
                            options.enum = resp.COLUMN_TYPE.substring(
                                5,
                                resp.COLUMN_TYPE.length - 1
                            )
                                .replace(/'/gi, "")
                                .split(",");
                            break;
                        case "set":
                            tscType = `(${resp.COLUMN_TYPE.substring(
                                4,
                                resp.COLUMN_TYPE.length - 1
                            )
                                .replace(/'/gi, '"')
                                .replace(/","/gi, '" | "')})[]`;
                            options.enum = resp.COLUMN_TYPE.substring(
                                4,
                                resp.COLUMN_TYPE.length - 1
                            )
                                .replace(/'/gi, "")
                                .split(",");
                            break;
                        case "json":
                            tscType = "object";
                            break;
                        case "binary":
                            tscType = "Buffer";
                            break;
                        case "varbinary":
                            tscType = "Buffer";
                            break;
                        case "geometry":
                            tscType = "string";
                            break;
                        case "point":
                            tscType = "string";
                            break;
                        case "linestring":
                            tscType = "string";
                            break;
                        case "polygon":
                            tscType = "string";
                            break;
                        case "multipoint":
                            tscType = "string";
                            break;
                        case "multilinestring":
                            tscType = "string";
                            break;
                        case "multipolygon":
                            tscType = "string";
                            break;
                        case "geometrycollection":
                        case "geomcollection":
                            columnType = "geometrycollection";
                            tscType = "string";
                            break;
                        default:
                            tscType = "NonNullable<unknown>";
                            TomgUtils.LogError(
                                `Unknown column type: ${resp.DATA_TYPE}  table name: ${resp.TABLE_NAME} column name: ${resp.COLUMN_NAME}`
                            );
                            break;
                    }
                    if (
                        this.ColumnTypesWithPrecision.some(
                            (v) => v === columnType
                        )
                    ) {
                        if (resp.NUMERIC_PRECISION !== null) {
                            options.precision = resp.NUMERIC_PRECISION;
                        }
                        if (resp.NUMERIC_SCALE !== null) {
                            options.scale = resp.NUMERIC_SCALE;
                        }
                    }
                    if (
                        this.ColumnTypesWithLength.some((v) => v === columnType)
                    ) {
                        options.length =
                            resp.CHARACTER_MAXIMUM_LENGTH > 0
                                ? resp.CHARACTER_MAXIMUM_LENGTH
                                : undefined;
                    }
                    if (
                        this.ColumnTypesWithWidth.some(
                            (v) => v === columnType && tscType !== "boolean"
                        )
                    ) {
                        options.width =
                            resp.CHARACTER_MAXIMUM_LENGTH > 0
                                ? resp.CHARACTER_MAXIMUM_LENGTH
                                : undefined;
                    }

                    /**
                     * contains calss-validator constraints
                     */
                    const constraints: string[] = [];
                    /**
                     * matching validator import statement
                     */
                    const classValidators = {}; // initialize calssValidatorImport
                    const isNullable =
                        resp.IS_NULLABLE === "YES" ? true : false;
                    // add optional chaining (?.) if column nullable or has default or is auto-increment or foreign key or foreign key
                    const chainingSymbol =
                        isNullable ||
                        resp.COLUMN_DEFAULT !== null ||
                        generated ||
                        resp.REFERENCED_TABLE_NAME
                            ? "?"
                            : "";

                    // enforce varchar max lengths
                    if (
                        resp.DATA_TYPE === "varchar" &&
                        resp.CHARACTER_MAXIMUM_LENGTH
                    ) {
                        classValidators["MaxLength"] = "true";
                        constraints.push(
                            `@MaxLength(${resp.CHARACTER_MAXIMUM_LENGTH})`
                        );
                    }
                    // enforce number on numbers 32-bits or less
                    if (
                        resp.DATA_TYPE === "int" ||
                        resp.DATA_TYPE === "smallint" ||
                        (resp.DATA_TYPE === "tinyint" && options.width !== 1) // not boolean
                    ) {
                        classValidators["IsNumber"] = "true";
                        constraints.push("@IsNumber()");
                    }
                    // enforce number on 64-bit numbers represented as string in Javascript
                    if (resp.DATA_TYPE === "bigint") {
                        classValidators["IsNumberString"] = "true";
                        constraints.push("@IsNumberString()");
                    }
                    // pull enum values and add to constraints
                    if (resp.DATA_TYPE === "enum") {
                        classValidators["IsIn"] = "true";
                        constraints.push(
                            `@IsIn([${resp.COLUMN_TYPE.substring(
                                5,
                                resp.COLUMN_TYPE.length - 1
                            )}])`
                        );
                    }
                    // if column value is required
                    if (!chainingSymbol) {
                        classValidators["IsNotEmpty"] = "true";
                        constraints.push("@IsNotEmpty()");
                    }
                    // add optional flag if there is any constraints and the column value is not required
                    if (chainingSymbol && constraints.length) {
                        classValidators["IsOptional"] = "true";
                        constraints.push("@IsOptional()");
                    }

                    // add common entity validator import
                    if (Object.keys(classValidators).length) {
                        ent.classValidators = {
                            ...ent.classValidators, // can be null/undefined
                            ...classValidators,
                        };
                    }

                    ent.columns.push({
                        generated,
                        type: columnType,
                        default: defaultValue,
                        transformer,
                        options,
                        tscName,
                        tscType,
                        constraints, // add constraints based on constraints
                        chainingSymbol,
                    });
                });
        });
        return entities;
    }

    public async GetIndexesFromEntity(
        entities: Entity[],
        schemas: string[],
        dbNames: string[]
    ): Promise<Entity[]> {
        /* eslint-disable camelcase */
        const response = await this.ExecQuery<{
            TableName: string;
            IndexName: string;
            ColumnName: string;
            is_unique: number;
            is_primary_key: number;
            is_fulltext: number;
        }>(`SELECT TABLE_NAME TableName,INDEX_NAME IndexName,COLUMN_NAME ColumnName,CASE WHEN NON_UNIQUE=0 THEN 1 ELSE 0 END is_unique,
        CASE WHEN INDEX_NAME='PRIMARY' THEN 1 ELSE 0 END is_primary_key, CASE WHEN INDEX_TYPE="FULLTEXT" THEN 1 ELSE 0 END is_fulltext
        FROM information_schema.statistics sta
        WHERE table_schema IN (${MysqlDriver.buildEscapedObjectList(
            dbNames
        )})`);
        /* eslint-enable camelcase */
        entities.forEach((ent) => {
            const entityIndices = response.filter(
                (filterVal) => filterVal.TableName === ent.tscName
            );
            const indexNames = new Set(entityIndices.map((v) => v.IndexName));
            indexNames.forEach((indexName) => {
                const records = entityIndices.filter(
                    (v) => v.IndexName === indexName
                );

                const indexInfo: Index = {
                    name: indexName,
                    columns: [],
                    options: {},
                };
                if (records[0].is_primary_key === 1) indexInfo.primary = true;
                if (records[0].is_fulltext === 1)
                    indexInfo.options.fulltext = true;
                if (records[0].is_unique === 1) indexInfo.options.unique = true;

                records.forEach((record) => {
                    indexInfo.columns.push(record.ColumnName);
                });
                ent.indices.push(indexInfo);
            });
        });

        return entities;
    }

    public async GetRelations(
        entities: Entity[],
        schemas: string[],
        dbNames: string[],
        generationOptions: IGenerationOptions
    ): Promise<Entity[]> {
        const response = await this.ExecQuery<{
            TableWithForeignKey: string;
            // eslint-disable-next-line camelcase
            FK_PartNo: number;
            ForeignKeyColumn: string;
            TableReferenced: string;
            ForeignKeyColumnReferenced: string;
            onDelete: "RESTRICT" | "CASCADE" | "SET NULL" | "NO_ACTION";
            onUpdate: "RESTRICT" | "CASCADE" | "SET NULL" | "NO_ACTION";
            // eslint-disable-next-line camelcase
            object_id: string;
        }>(`SELECT
            CU.TABLE_NAME TableWithForeignKey,
            CU.ORDINAL_POSITION FK_PartNo,
            CU.COLUMN_NAME ForeignKeyColumn,
            CU.REFERENCED_TABLE_NAME TableReferenced,
            CU.REFERENCED_COLUMN_NAME ForeignKeyColumnReferenced,
            RC.DELETE_RULE onDelete,
            RC.UPDATE_RULE onUpdate,
            CU.CONSTRAINT_NAME object_id
           FROM
            INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU
           JOIN
            INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
                ON CU.CONSTRAINT_NAME=RC.CONSTRAINT_NAME AND CU.CONSTRAINT_SCHEMA = RC.CONSTRAINT_SCHEMA
          WHERE
            TABLE_SCHEMA IN (${MysqlDriver.buildEscapedObjectList(dbNames)})
            AND CU.REFERENCED_TABLE_NAME IS NOT NULL;
            `);
        const relationsTemp: RelationInternal[] = [] as RelationInternal[];
        const relationKeys = new Set(response.map((v) => v.object_id));

        relationKeys.forEach((relationId) => {
            const rows = response.filter((v) => v.object_id === relationId);
            const ownerTable = entities.find(
                (v) => v.sqlName === rows[0].TableWithForeignKey
            );
            const relatedTable = entities.find(
                (v) => v.sqlName === rows[0].TableReferenced
            );

            if (!ownerTable || !relatedTable) {
                TomgUtils.LogError(
                    `Relation between tables ${rows[0].TableWithForeignKey} and ${rows[0].TableReferenced} wasn't found in entity model.`,
                    true
                );
                return;
            }
            const internal: RelationInternal = {
                ownerColumns: [],
                relatedColumns: [],
                ownerTable,
                relatedTable,
            };
            if (rows[0].onDelete !== "NO_ACTION") {
                internal.onDelete = rows[0].onDelete;
            }
            if (rows[0].onUpdate !== "NO_ACTION") {
                internal.onUpdate = rows[0].onUpdate;
            }
            rows.forEach((row) => {
                internal.ownerColumns.push(row.ForeignKeyColumn);
                internal.relatedColumns.push(row.ForeignKeyColumnReferenced);
            });
            relationsTemp.push(internal);
        });

        const retVal = MysqlDriver.GetRelationsFromRelationTempInfo(
            relationsTemp,
            entities,
            generationOptions
        );
        return retVal;
    }

    public async DisconnectFromServer() {
        const promise = new Promise<boolean>((resolve, reject) => {
            this.Connection.end((err) => {
                if (!err) {
                    resolve(true);
                } else {
                    TomgUtils.LogError(
                        `Error disconnecting from ${this.EngineName} Server.`,
                        false,
                        err.message
                    );
                    reject(err);
                }
            });
        });
        if (this.Connection) {
            await promise;
        }
    }

    public async ConnectToServer(connectionOptons: IConnectionOptions) {
        const databaseName = connectionOptons.databaseNames[0];
        let config: MYSQL.ConnectionOptions;
        if (connectionOptons.ssl) {
            config = {
                database: databaseName,
                host: connectionOptons.host,
                password: connectionOptons.password,
                port: connectionOptons.port,
                ssl: {
                    rejectUnauthorized: false,
                },
                connectTimeout: 60 * 60 * 1000,
                user: connectionOptons.user,
            };
        } else {
            config = {
                database: databaseName,
                host: connectionOptons.host,
                password: connectionOptons.password,
                port: connectionOptons.port,
                connectTimeout: 60 * 60 * 1000,
                user: connectionOptons.user,
            };
        }

        const promise = new Promise<boolean>((resolve, reject) => {
            this.Connection = this.MYSQL.createConnection(config);

            this.Connection.connect((err) => {
                if (!err) {
                    resolve(true);
                } else {
                    TomgUtils.LogError(
                        `Error connecting to ${this.EngineName} Server.`,
                        false,
                        err.message
                    );
                    reject(err);
                }
            });
        });

        await promise;
    }

    public async CreateDB(dbName: string) {
        await this.ExecQuery(`CREATE DATABASE \`${dbName}\`; `);
    }

    public async UseDB(dbName: string) {
        await this.ExecQuery(`USE \`${dbName}\`; `);
    }

    public async DropDB(dbName: string) {
        await this.ExecQuery(`DROP DATABASE \`${dbName}\`; `);
    }

    public async CheckIfDBExists(dbName: string): Promise<boolean> {
        const resp = await this.ExecQuery(`SHOW DATABASES LIKE "${dbName}" `);
        return resp.length > 0;
    }

    public async ExecQuery<T>(sql: string): Promise<T[]> {
        const ret: T[] = [];
        const query = this.Connection.query(sql);
        const stream = query.stream({});
        const promise = new Promise<boolean>((resolve, reject) => {
            stream.on("data", (chunk) => {
                ret.push((chunk as unknown) as T);
            });
            stream.on("error", (err) => reject(err));
            stream.on("end", () => resolve(true));
        });
        await promise;
        return ret;
    }

    private static ReturnDefaultValueFunction(
        defVal: string | undefined,
        dataType: string
    ): string | undefined {
        let defaultValue = defVal;
        if (!defaultValue || defaultValue === "NULL") {
            return undefined;
        }
        if (defaultValue.toLowerCase() === "current_timestamp()") {
            defaultValue = "CURRENT_TIMESTAMP";
        }
        if (
            defaultValue === "CURRENT_TIMESTAMP" ||
            defaultValue.startsWith(`'`)
        ) {
            return `() => "${defaultValue}"`;
        }
        if (dataType === "set") {
            return `() => ['${defaultValue.split(",").join("','")}']`;
        }

        return `() => "'${defaultValue}'"`;
    }

    private static ReturnDatatypeTransformer(
        dataType: string,
        columnType: string,
        generateTinyintTransformer?: boolean,
        generateBigintTransformer?: boolean
    ): string | undefined {
        if (
            generateTinyintTransformer &&
            (columnType === "tinyint(1)" ||
                columnType === "tinyint(1) unsigned")
        ) {
            // do not transform null or undefined
            return `{ from: (value: number) => value === null || value === undefined ? value : Boolean(value), to: (value: boolean) => value === null || value === undefined ? value : Number(value) }`;
        } else if (generateBigintTransformer && dataType === "bigint") {
            // do not transform null or undefined
            // watch out for 32-bit int overflow if using this option
            return `{ from: (value: string) => value === null || value === undefined ? value : Number(value), to: (value: number) => value === null || value === undefined ? value : String(value) }`;
        }
        return undefined;
    }
}
