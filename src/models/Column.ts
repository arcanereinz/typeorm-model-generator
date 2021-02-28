import { ColumnType } from "typeorm";

export type Column = {
    tscType: string;
    tscName: string;
    type: ColumnType | string; // TODO: remove ?
    isUsedInRelationAsOwner?: true; // TODO: move to separate object/calulate when us
    isUsedInRelationAsReferenced?: true; // TODO: move to separate object/calulate when us

    primary?: boolean;
    generated?: true | "increment" | "uuid";
    default?: string; // ?
    // convert between: bool <=> tinyint(1) <signed|unsigned>
    transformer?: string; // content-type: ValueTransformer | ValueTransformer[];
    constraints?: string[];
    chainingSymbol?: string; // controls if we should '?.' or '.' based on column properties
    options: {
        name: string;
        length?: number;
        width?: number;
        nullable?: boolean;
        unique?: boolean; // ?
        precision?: number;
        scale?: number;
        unsigned?: boolean;
        enum?: string[];
        array?: boolean; // ?
        comment?: string;
    };
};
