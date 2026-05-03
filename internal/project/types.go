package project

// Runtime project file — single source of truth. Generated types: internal/project/types.go
// + packages/shared-types/src/project.ts
type Types struct {
	// Alarm rules evaluated against live tag values
	AlarmRules  []AlarmRule         `json:"alarmRules,omitempty"`
	Datasources []DatasourceElement `json:"datasources"`
	// Human-readable project name
	Name    *string       `json:"name,omitempty"`
	Pages   []PageElement `json:"pages"`
	// Named parameter sets for batch writes
	Recipes []Recipe      `json:"recipes,omitempty"`
	// Schema version, e.g. '0.1.0'
	Version string `json:"version"`
}

// Recipe is a named set of tag write operations applied atomically.
type Recipe struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	Entries     []RecipeEntry `json:"entries"`
}

// RecipeEntry is a single binding→value pair in a recipe.
type RecipeEntry struct {
	// "datasource_id:tag_path"
	Binding string `json:"binding"`
	Value   any    `json:"value"`
}

// AlarmRule defines when an alarm should fire based on a tag value.
type AlarmRule struct {
	// Comparison operator: gt, gte, lt, lte, eq, ne
	Condition string  `json:"condition"`
	ID        string  `json:"id"`
	// datasource_id:tag_path, e.g. 'opcua:ns=2;s=PLCnext.pressure'
	Binding   string  `json:"binding"`
	Message   string  `json:"message"`
	Name      string  `json:"name"`
	// critical, warning, info
	Severity  string  `json:"severity"`
	Threshold float64 `json:"threshold"`
}

type DatasourceElement struct {
	Config                                              DatasourceConfig `json:"config"`
	// Unique driver instance ID, e.g. 'opcua', 'mbtcp1'                 
	ID                                                  string           `json:"id"`
	Label                                               string           `json:"label"`
	Type                                                DatasourceType   `json:"type"`
}

// Driver-specific connection config. Fields used depend on 'type'.
type DatasourceConfig struct {
	// REST base path, e.g. /_pxc_api/                
	BasePath                          *string         `json:"basePath,omitempty"`
	// REST bearer token                              
	BearerToken                       *string         `json:"bearerToken,omitempty"`
	// MQTT client ID                                 
	ClientID                          *string         `json:"clientId,omitempty"`
	// OPC UA: opc.tcp://host:port                    
	Endpoint                          *string         `json:"endpoint,omitempty"`
	// Modbus/MQTT/REST host                          
	Host                              *string         `json:"host,omitempty"`
	Password                          *string         `json:"password,omitempty"`
	// TCP port                                       
	Port                              *int64          `json:"port,omitempty"`
	SecurityMode                      *SecurityMode   `json:"securityMode,omitempty"`
	SecurityPolicy                    *SecurityPolicy `json:"securityPolicy,omitempty"`
	// Modbus slave/unit ID                           
	SlaveID                           *int64          `json:"slaveId,omitempty"`
	Username                          *string         `json:"username,omitempty"`
}

type PageElement struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	Widgets []WidgetElement `json:"widgets"`
}

type WidgetElement struct {
	// datasource_id:tag_path, e.g. 'opcua:ns=2;s=PLCnext.iTest'              
	Binding                                                     *string       `json:"binding,omitempty"`
	Config                                                      *WidgetConfig `json:"config,omitempty"`
	// Height in grid units                                                   
	H                                                           int64         `json:"h"`
	ID                                                          string        `json:"id"`
	Type                                                        WidgetType    `json:"type"`
	// Width in grid units                                                    
	W                                                           int64         `json:"w"`
	// Grid column                                                            
	X                                                           int64         `json:"x"`
	// Grid row                                                               
	Y                                                           int64         `json:"y"`
}

// Per-widget configuration. Fields depend on type.
type WidgetConfig struct {
	// Trend history window in seconds                        
	Duration                               *int64             `json:"duration,omitempty"`
	// LED color when false                                   
	FalseColor                             *string            `json:"falseColor,omitempty"`
	// printf-style format, e.g. '%.2f'                       
	Format                                 *string            `json:"format,omitempty"`
	Label                                  *string            `json:"label,omitempty"`
	Max                                    *float64           `json:"max,omitempty"`
	Min                                    *float64           `json:"min,omitempty"`
	// Button: true=momentary, false=toggle                   
	Momentary                              *bool              `json:"momentary,omitempty"`
	// Button off/release value                               
	OffValue                               interface{}        `json:"offValue"`
	// Button on-press value                                  
	OnValue                                interface{}        `json:"onValue"`
	// HistoryLog rows per page                               
	PageSize                               *int64             `json:"pageSize,omitempty"`
	Thresholds                             []ThresholdElement `json:"thresholds,omitempty"`
	// LED color when true                                    
	TrueColor                              *string            `json:"trueColor,omitempty"`
	Unit                                   *string            `json:"unit,omitempty"`
}

type ThresholdElement struct {
	// CSS color, e.g. '#22c55e'        
	Color                       string  `json:"color"`
	Value                       float64 `json:"value"`
}

type SecurityMode string

const (
	SecurityModeNone SecurityMode = "None"
	Sign             SecurityMode = "Sign"
	SignAndEncrypt   SecurityMode = "SignAndEncrypt"
)

type SecurityPolicy string

const (
	Basic128Rsa15      SecurityPolicy = "Basic128Rsa15"
	Basic256           SecurityPolicy = "Basic256"
	Basic256Sha256     SecurityPolicy = "Basic256Sha256"
	SecurityPolicyNone SecurityPolicy = "None"
)

type DatasourceType string

const (
	Mbtcp DatasourceType = "mbtcp"
	Mqtt  DatasourceType = "mqtt"
	Opcua DatasourceType = "opcua"
	REST  DatasourceType = "rest"
)

type WidgetType string

const (
	Button         WidgetType = "button"
	Gauge          WidgetType = "gauge"
	HistoryLog     WidgetType = "historyLog"
	LED            WidgetType = "led"
	NumericDisplay WidgetType = "numericDisplay"
	NumericInput   WidgetType = "numericInput"
	TextDisplay    WidgetType = "textDisplay"
	TextInput      WidgetType = "textInput"
	Trend          WidgetType = "trend"
)
