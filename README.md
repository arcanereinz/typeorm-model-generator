# typeorm-model-generator

[![npm version](https://badge.fury.io/js/typeorm-model-generator.svg)](https://badge.fury.io/js/typeorm-model-generator)
[![codecov](https://codecov.io/gh/Kononnable/typeorm-model-generator/branch/master/graph/badge.svg)](https://codecov.io/gh/Kononnable/typeorm-model-generator)

<!-- ***
## :warning: This project is in a maintenance phase. See [#329](https://github.com/Kononnable/typeorm-model-generator/issues/329) for details.
*** -->

Generates models for TypeORM from existing databases.
Supported db engines:
* Microsoft SQL Server
* PostgreSQL
* MySQL
* MariaDB
* Oracle Database
* SQLite

## Installation

### Changelog

**2021-02-26:**

- maps `tinyint(1) unsgined` to boolean
- added `--generateTransformer` to convert tinyint(1) <=> boolean when reading and writing to the database

### Versions
Typeorm-model-generator comes with preinstalled driver for each supported db(except for oracle). However if you want to use it as a dev-dependency you may want to install your db driver manually to reduce dependency footprint, reduce time spent in the CI. In such case you can use version without preinstalled db drivers - `npm i typeorm-model-generator@no-engines`.  
### Global module
To install module globally simply type `npm i -g typeorm-model-generator` in your console.
### Npx way
Thanks to npx you can use npm modules without polluting global installs. So nothing to do here :)
>To use `npx` you need to use npm at version at least 5.2.0. Try updating your npm by `npm i -g npm`
### Database drivers
All database drivers except oracle are installed by default. To use typeorm-model-generator with oracle database you need to install driver with `npm i oracledb` and configure [oracle install client](http://www.oracle.com/technetwork/database/database-technologies/instant-client/overview/index.html) on your machine.

## Usage 
There are two way to use this utility:
- Use step by step wizard which will guide you though the process - just type `npx typeorm-model-generator` in your console.
- Provide all parameters through command line(examples below)


Use `npx typeorm-model-generator --help` to see all available parameters with their descriptions. Some basic parameters below:
```shell
Usage: typeorm-model-generator -h <host> -d <database> -p [port] -u <user> -x
[password] -e [engine]

Options:
      --help                       Show help                                           [boolean]
      --version                    Show version number                                 [boolean]
  -h, --host                       IP address/Hostname for database server             [string] [default: "127.0.0.1"]
  -d, --database                   Database name(or path for sqlite). You can
                                   pass multiple values separated by comma.            [string] [required] [default: ""]
  -u, --user                       Username for database server                        [string] [default: ""]
  -x, --pass                       Password for database server                        [string] [default: ""]
  -p, --port                       Port number for database server                     [number] [default: 0]
  -e, --engine                     Database engine                                     [required] [choices: "mssql", "postgres", "mysql", "mariadb", "oracle", "sqlite"]
  -o, --output                     Where to place generated models                     [default: "./output"]
  -s, --schema                     Schema name to create model from. Only for
                                   mssql and postgres. You can pass multiple
                                   values separated by comma eg. -s
                                   scheme1,scheme2,scheme3                             [string] [default: ""]
  -i, --instance                   Named instance to create model from. Only for mssql.[string]
      --ssl                        Use SSL connection                                  [boolean] [default: false]
      --noConfig                   Do not create tsconfig.json and ormconfig.json      [boolean] [default: false]
      --cf, --case-file            Convert file names to specified case                [choices: "pascal", "param", "camel", "none"] [default: "pascal"]
      --ce, --case-entity          Convert class names to specified case               [choices: "pascal", "camel", "none"] [default: "pascal"]
      --cp, --case-property        Convert property names to specified case            [choices: "pascal", "camel", "snake", "none"] [default: "camel"]
      --eol                        Force EOL to be LF or CRLF                          [choices: "LF", "CRLF"] [default: "LF"]
      --pv, --property-visibility  Defines which visibility should have
                                   the generated property                              [choices: "public", "protected", "private", "none"] [default: "none"]
      --lazy                       Generate lazy relations                             [boolean] [default: false]
  -a, --active-record              Use ActiveRecord syntax for generated models        [boolean] [default: false]
      --namingStrategy             Use custom naming strategy                          [string] [default: ""]
      --relationIds                Generate RelationId fields                          [boolean] [default: false]
      --skipSchema                 Omits schema identifier in generated entities       [boolean] [default: false]
      --generateConstructor        Generate constructor allowing partial initialization[boolean] [default: false]
      --generateTransformer        Generate transformer that converts
                                    boolean <=> tinyint(1) <signed|usigned>            [boolean] [default: false]
      --disablePluralization       Disable pluralization of OneToMany,
                                   ManyToMany relation names                           [boolean] [default: false]
      --skipTables                 Skip schema generation for specific tables.
                                   You can pass multiple values separated by comma     [string] [default: ""]
      --tables                     Generate specific tables. You can pass
                                   multiple values separated by comma                  [string] [default: ""]
      --strictMode                 Mark fields as optional(?) or non-null(!)           [choices: "none", "?", "!"] [default: "none"]
      --index                      Generate index file                                 [boolean] [default: false]
      --defaultExport              Generate index file                                 [boolean] [default: false]

```
### Examples

* Creating model from local MSSQL database
   * Global module
      ```
      typeorm-model-generator -h localhost -d tempdb -u sa -x !Passw0rd -e mssql -o .
      ````
   * Npx Way
      ```
      npx typeorm-model-generator -h localhost -d tempdb -u sa -x !Passw0rd -e mssql -o .
      ````
* Creating model from local Postgres database, public schema with ssl connection
   * Global module
      ```
      typeorm-model-generator -h localhost -d postgres -u postgres -x !Passw0rd -e postgres -o . -s public --ssl
      ````
   * Npx Way
      ```
      npx typeorm-model-generator -h localhost -d postgres -u postgres -x !Passw0rd -e postgres -o . -s public --ssl
      ````
* Creating model from SQLite database
   * Global module
      ```
      typeorm-model-generator -d "Z:\sqlite.db" -e sqlite -o .
      ````
   * Npx Way
      ```
      npx typeorm-model-generator -d "Z:\sqlite.db" -e sqlite -o .
      ````
## Use Cases
Please take a look at [few workflows](USECASES.md) which might help you with deciding how you're gonna use typeorm-model-generator.
## Naming strategy
If you want to generate custom names for properties in generated entities you need to use custom naming strategy. You need to create your own version of [NamingStrategy](https://github.com/Kononnable/typeorm-model-generator/blob/master/src/NamingStrategy.ts) and pass it as command parameter.

```typeorm-model-generator -d typeorm_mg --namingStrategy=./NamingStrategy -e sqlite -db /tmp/sqliteto.db```
