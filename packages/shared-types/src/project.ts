/**
 * Runtime project file — single source of truth. Generated types: internal/project/types.go
 * + packages/shared-types/src/project.ts
 */
export interface Project {
    datasources: DatasourceElement[];
    /**
     * Human-readable project name
     */
    name?: string;
    pages: PageElement[];
    /**
     * Schema version, e.g. '0.1.0'
     */
    version: string;
}

export interface DatasourceElement {
    config: DatasourceConfig;
    /**
     * Unique driver instance ID, e.g. 'opcua', 'mbtcp1'
     */
    id:    string;
    label: string;
    type:  DatasourceType;
}

/**
 * Driver-specific connection config. Fields used depend on 'type'.
 */
export interface DatasourceConfig {
    /**
     * REST base path, e.g. /_pxc_api/
     */
    basePath?: string;
    /**
     * REST bearer token
     */
    bearerToken?: string;
    /**
     * MQTT client ID
     */
    clientId?: string;
    /**
     * OPC UA: opc.tcp://host:port
     */
    endpoint?: string;
    /**
     * Modbus/MQTT/REST host
     */
    host?:     string;
    password?: string;
    /**
     * TCP port
     */
    port?:           number;
    securityMode?:   SecurityMode;
    securityPolicy?: SecurityPolicy;
    /**
     * Modbus slave/unit ID
     */
    slaveId?:  number;
    username?: string;
    [property: string]: any;
}

export enum SecurityMode {
    None = "None",
    Sign = "Sign",
    SignAndEncrypt = "SignAndEncrypt",
}

export enum SecurityPolicy {
    Basic128Rsa15 = "Basic128Rsa15",
    Basic256 = "Basic256",
    Basic256Sha256 = "Basic256Sha256",
    None = "None",
}

export enum DatasourceType {
    Mbtcp = "mbtcp",
    Mqtt = "mqtt",
    Opcua = "opcua",
    REST = "rest",
}

export interface PageElement {
    id:      string;
    name:    string;
    widgets: WidgetElement[];
}

export interface WidgetElement {
    /**
     * datasource_id:tag_path, e.g. 'opcua:ns=2;s=PLCnext.iTest'
     */
    binding?: string;
    config?:  WidgetConfig;
    /**
     * Height in grid units
     */
    h:    number;
    id:   string;
    type: WidgetType;
    /**
     * Width in grid units
     */
    w: number;
    /**
     * Grid column
     */
    x: number;
    /**
     * Grid row
     */
    y: number;
}

/**
 * Per-widget configuration. Fields depend on type.
 */
export interface WidgetConfig {
    /**
     * Trend history window in seconds
     */
    duration?: number;
    /**
     * LED color when false
     */
    falseColor?: string;
    /**
     * printf-style format, e.g. '%.2f'
     */
    format?: string;
    label?:  string;
    max?:    number;
    min?:    number;
    /**
     * Button: true=momentary, false=toggle
     */
    momentary?: boolean;
    /**
     * Button off/release value
     */
    offValue?: any;
    /**
     * Button on-press value
     */
    onValue?: any;
    /**
     * HistoryLog rows per page
     */
    pageSize?:   number;
    thresholds?: ThresholdElement[];
    /**
     * LED color when true
     */
    trueColor?: string;
    unit?:      string;
    [property: string]: any;
}

export interface ThresholdElement {
    /**
     * CSS color, e.g. '#22c55e'
     */
    color: string;
    value: number;
}

export enum WidgetType {
    Button = "button",
    Gauge = "gauge",
    HistoryLog = "historyLog",
    LED = "led",
    NumericDisplay = "numericDisplay",
    NumericInput = "numericInput",
    TextDisplay = "textDisplay",
    TextInput = "textInput",
    Trend = "trend",
}
