# X-HMI Competitive Analysis

**Date:** May 2026  
**Product:** X-HMI — Web-based Industrial HMI Platform (Go + React, targeting Phoenix Contact PLCnext AXC F 3152)  
**Purpose:** Inform product roadmap decisions with a structured view of the competitive landscape.

---

## Table of Contents

1. [Competitor Profiles](#1-competitor-profiles)
2. [X-HMI Positioning Summary](#2-x-hmi-positioning-summary)
3. [Where X-HMI Leads](#3-where-x-hmi-leads)
4. [Competitive Gaps — What X-HMI Lacks](#4-competitive-gaps--what-x-hmi-lacks)
5. [Top 10 High-Impact Features to Add Next](#5-top-10-high-impact-features-to-add-next)

---

## 1. Competitor Profiles

### 1.1 Ignition by Inductive Automation

**Overview:** The dominant modern SCADA platform. Java-based gateway with web-delivered clients. Modular architecture with optional add-on modules for Perspective (web HMI), Vision (legacy desktop), Reporting, MES, Tag Historian, and more.

**Target Market:** Mid-to-large industrial facilities, system integrators, water/wastewater, manufacturing, oil & gas.

**Key Strengths:**
- Unlimited tags and clients on a single license (no per-tag cost)
- Massive ecosystem: 5,000+ integrators, Ignition Exchange marketplace, active community (Ignition Forum)
- Ignition Edge runs on ARM32/ARM64 devices (Raspberry Pi, field gateways) — directly competitive with the PLCnext use case
- Native OPC-UA, MQTT Sparkplug B, SQL historian, alarm pipelines, reporting engine, scripting (Jython/Python)
- Designer is a full IDE with template inheritance, UDTs (User-Defined Tag Types), and project versioning
- Free trial with no time limit in development mode; full production license unlocks at gateway level

**Key Weaknesses:**
- Java runtime is heavy — 200–500 MB footprint; slow cold-start on constrained edge hardware
- Steep learning curve; the Designer tool is desktop-only (not web-based), requiring install on engineering workstations
- Cost becomes significant at enterprise scale with multiple modules and support tiers
- Perspective module (web HMI) is notably less polished than legacy Vision for some use cases
- Documentation quality is inconsistent across modules; third-party modules vary widely in quality

**Pricing:**
- Base platform: ~$1,100 (one-time perpetual) at the low end; full suites start around $3,000–$7,500+
- Annual support: 16–24% of license cost depending on tier (BasicCare / TotalCare / PriorityCare)
- Ignition Edge (per-device): perpetual license; ARM-capable; limited to 1 project, no embedded database

**X-HMI vs. Ignition:** Ignition is the benchmark. X-HMI's all-in-one binary with no runtime dependency is a meaningful deployment advantage on constrained hardware. X-HMI's web-IDE eliminates the desktop Designer install requirement. However, Ignition's tag UDT system, scripting engine, reporting, and integrator ecosystem dwarf X-HMI's current capabilities.

---

### 1.2 AVEVA System Platform (formerly Wonderware)

**Overview:** Enterprise-class SCADA/HMI platform from AVEVA (acquired by Schneider Electric). InTouch HMI is the operator-facing product; System Platform is the supervisory/data layer. Long heritage in process industries.

**Target Market:** Large process plants (oil & gas, pharma, chemicals, utilities), enterprises requiring multi-site, multi-user, historian-integrated SCADA.

**Key Strengths:**
- Template/inheritance-driven engineering model (Object Derivation) — changes to a parent template propagate automatically across thousands of instances
- OMI (Operations Management Interface) enables responsive, device-adaptive displays built once and deployed anywhere
- Deep historian integration (AVEVA Historian, formerly Wonderware Historian) with high-performance time-series storage
- Large legacy installed base with established migration tools from legacy InTouch projects
- Tight integration with Schneider Electric hardware ecosystem

**Key Weaknesses:**
- Very high cost — System Platform requires professional services for deployment; entry price for InTouch is ~$1,795 for 1,000 tags, but full System Platform is typically $20,000–$100,000+ for enterprise deployments
- Complex licensing with separate products for development, runtime, historian, reporting
- Heavy Windows-centric deployment model; limited edge/embedded support
- Slow release cadence; innovations lag behind newer entrants
- Steep learning curve; generally requires certified integrators

**Pricing:**
- AVEVA InTouch HMI: ~$1,795 (perpetual, 1,000-tag limited version)
- Full System Platform: quote-based, typically $20k–$100k+
- Annual maintenance separate; subscription-only cloud tiers available

**X-HMI vs. AVEVA:** No overlap in target market today. AVEVA targets enterprise-scale, multi-plant deployments with 10,000+ tags, certified integrators, and IT/OT convergence. X-HMI targets embedded single-controller deployments. The gap in template/inheritance patterns and enterprise historian are the most relevant lessons for X-HMI's roadmap.

---

### 1.3 Siemens WinCC OA / WinCC Unified

**Overview:** Siemens offers two distinct lineages. WinCC OA (formerly PVSS) is a high-end, large-scale SCADA platform used in accelerators (CERN), transportation, and critical infrastructure. WinCC Unified is the modern successor to the classic WinCC V7/V8, built on HTML5/SVG/JavaScript with a web-centric architecture.

**Target Market:** WinCC OA — very large, complex, vendor-independent SCADA (1M+ tags, redundancy). WinCC Unified — Siemens PLC ecosystem users (S7-1200/1500), manufacturing, machine builders.

**Key Strengths (Unified):**
- Built on HTML5/SVG/JavaScript — responsive from panel to full SCADA
- Native integration with Siemens S7 PLCs and TIA Portal ecosystem; no third-party OPC needed for Siemens hardware
- Scalable tag-based licensing from small systems to unlimited
- Built-in redundancy and high-availability modes
- Strong cybersecurity focus (ISA/IEC 62443 alignment)

**Key Weaknesses:**
- WinCC OA: prohibitively complex and expensive for anything below large infrastructure projects
- WinCC Unified: deeply tied to the Siemens ecosystem; limited value for non-Siemens hardware
- Licensing model based on tag count and web-client count creates unpredictable costs
- Both products require Windows engineering workstations for development
- Customer lock-in is a design feature, not a bug

**Pricing:**
- Tag-count + web-client-count based; custom quotes via Siemens Industry Mall
- WinCC Unified entry: estimated $2,000–$5,000 for small systems; no public list pricing

**X-HMI vs. WinCC:** Siemens WinCC Unified is the natural comparison for machine-builder HMI on a specific controller platform. X-HMI mirrors this role but for Phoenix Contact PLCnext. The key lesson: X-HMI should lean into first-class PLCnext integration (GDS, pxc_api, PLCnext Runtime awareness) as a hard-to-replicate differentiator, exactly as Siemens leverages TIA Portal integration.

---

### 1.4 Phoenix Contact PLCnext eHMI (built-in)

**Overview:** The eHMI is a visualization subsystem built into PLCnext Engineer (the official IDE). It generates HTML5 screens from a graphical designer in PLCnext Engineer and serves them directly from the controller's web server. It is not a standalone product — it is an included feature of PLCnext Engineer.

**Target Market:** PLCnext users who need simple operator panels without purchasing third-party HMI software.

**Key Strengths:**
- Zero additional cost — bundled with PLCnext Engineer (free download)
- Direct, native access to GDS (Global Data Space) variables on the PLCnext Runtime without external protocol configuration
- Tight integration with PLCnext Engineer workflow: tags come directly from the PLC project
- HTML5-based — works in any browser on the LAN

**Key Weaknesses:**
- Very limited widget set — basic buttons, gauges, and numeric displays
- No historian, no alarm engine, no trend visualization
- No drag-and-drop canvas; layout is constrained and not production-grade for complex operator displays
- Screen design is tightly coupled to PLCnext Engineer and the PLC project; difficult to iterate without a full PLC recompile cycle
- No support for Modbus, MQTT, OPC UA, REST in the HMI layer — only GDS variable binding
- No independent runtime — HMI is served from the controller's own CPU, consuming resources alongside the PLC task
- No multi-controller or aggregation capability

**Pricing:** Free (bundled with PLCnext Engineer)

**X-HMI vs. eHMI:** X-HMI is the direct upgrade path from eHMI. X-HMI already offers dramatically more capability: 11 widget types vs. the eHMI's handful, an alarm engine, historian, multi-protocol support, and a purpose-built web IDE that does not require PLCnext Engineer to be running. The narrative is clear: eHMI for quick start, X-HMI for production operator panels.

---

### 1.5 Grafana

**Overview:** Open-source observability and visualization platform originally built for metrics/APM. Increasingly used in IIoT contexts for plant-floor dashboarding via plugins (e.g., OPC-UA datasource, MQTT, Infinity plugin). Not a SCADA system — no write/control capability in the core product.

**Target Market:** DevOps/SRE teams, data engineers, IIoT architects who want flexible dashboards on top of time-series databases (InfluxDB, Prometheus, TimescaleDB, etc.).

**Key Strengths:**
- Exceptional time-series visualization: multi-series charts, annotations, variable templating, alerting
- Huge plugin ecosystem (300+ datasource plugins)
- Grafana Cloud Free tier ($0/month) through to Pro/Enterprise; self-hosted OSS is completely free
- Familiar to IT/DevOps audiences; easy to integrate with cloud infrastructure
- Active community and extensive documentation

**Key Weaknesses:**
- No native write/control to PLCs or field devices — read-only dashboarding only without heavy middleware
- Data latency is inherent: Grafana queries a database, not live device registers; typically 5–15 second lag in IIoT setups
- Not a real SCADA tool: no alarm acknowledgment workflow, no operator event logging, no tag historian in the industrial sense
- SVG/SCADA-style process graphics require third-party plugins (SCADAvis) that are community-maintained and limited
- No native OPC-UA server, no Modbus, no industrial protocol stack — requires gateway middleware (OAS, Kepware, etc.)
- Not designed for air-gapped or OT-network-isolated deployments

**Pricing:**
- Grafana OSS: free, self-hosted
- Grafana Cloud: Free (limited metrics/logs), Pro ~$19/month, Advanced ~$55/month
- Grafana Enterprise (self-hosted): per-user/cluster subscription pricing

**X-HMI vs. Grafana:** Grafana excels at visualization but fails as an HMI: no write-back, high data latency, no alarm ACK, and no industrial protocol stack. X-HMI's real-time WebSocket tag streaming, direct OPC-UA/Modbus read-write, and alarm engine address every major gap. Grafana is the benchmark for chart quality and dashboard composability — X-HMI's trend widget should aspire to Grafana's annotation, zoom, and multi-series UX.

---

### 1.6 Node-RED

**Overview:** Open-source, low-code, flow-based programming tool from IBM (now OpenJS Foundation). Extremely popular for IIoT edge computing: protocol bridging, data transformation, and lightweight dashboarding via the Dashboard 2 plugin.

**Target Market:** IIoT engineers and hobbyists, edge gateway developers, rapid-prototype scenarios. Heavy use in manufacturing, smart buildings, and energy at the data-flow/integration layer.

**Key Strengths:**
- Massive community: 5,000+ nodes (plugins) covering virtually every protocol, cloud service, and device
- Zero-cost, fully open-source; runs on any Linux device (including PLCnext)
- Low barrier to entry for flow-based integration logic
- Dashboard 2.0 plugin provides reactive web dashboards — buttons, gauges, charts, forms
- Ideal for edge protocol bridging: OPC-UA → MQTT → REST, etc.

**Key Weaknesses:**
- Dashboard is not a production HMI: limited layout control, no undo/redo in flow editor, no alarm ACK, no historian
- No native industrial widget set (no tanks, setpoints, history logs, trend with zoom)
- Flows are JavaScript runtime — harder to version-control, audit, and manage at scale
- No role-based access control in the base product (Dashboard lacks user management)
- Performance degrades with large flows and frequent message throughput
- Not designed for mission-critical, safety-adjacent control: no redundancy, no ISA-18.2 alarm management

**Pricing:** Free, open-source. Commercial support via FlowFuse ($19+/month/user for managed platform).

**X-HMI vs. Node-RED:** Node-RED is complementary, not a direct competitor. Many PLCnext users already run Node-RED for protocol bridging. X-HMI focuses on the operator panel layer that Node-RED Dashboard does not adequately address. X-HMI should consider a Node-RED data source integration (Node-RED → X-HMI via MQTT or REST) to position as the HMI layer on top of Node-RED flows.

---

### 1.7 Home Assistant

**Overview:** Open-source home automation platform with 3,000+ integrations and a large community. Not designed for industrial use, but increasingly adopted in light commercial and building-automation contexts due to its zero-cost, active development, and excellent UX.

**Target Market:** Residential automation, light commercial buildings, prosumers and makers. Some adoption in edge-adjacent IIoT where certification and SIL ratings are not required.

**Key Strengths:**
- Exceptional UX: Lovelace dashboard is best-in-class for drag-and-drop, responsive, mobile-first design
- Massive integration library (Modbus, MQTT, and some OPC-UA via community add-ons)
- Completely free and open-source; active contributor base drives rapid feature development
- Automation engine, notification system, and user management are built-in
- Energy monitoring and analytics dashboards are production-quality

**Key Weaknesses:**
- Not industrially certified: no IEC 62443, no ISA-18.2 alarm management, no SIL rating
- OPC-UA support is community-maintained and marked "not for production use"
- No industrial historian: time-series data stored in SQLite by default, poor scalability
- No native concept of alarm acknowledgment, process limits, or operator event logging
- Assumes internet connectivity for many features; not designed for air-gapped OT networks
- Write-back to Modbus is supported but unreliable and unsupported at production scale
- No engineering/operator role separation; single-user permission model

**Pricing:** Free, open-source. Home Assistant Cloud (Nabu Casa): $6.50/month for remote access.

**X-HMI vs. Home Assistant:** Home Assistant is a UX benchmark for widget design and drag-and-drop IDE experience. Its Lovelace editor is what X-HMI's canvas IDE should aspire to in terms of responsiveness and widget composability. However, Home Assistant cannot replace an industrial HMI: no alarm ACK, no certified protocol stack, no role-based operator security.

---

### 1.8 VTScada

**Overview:** Full-featured SCADA/HMI suite from Trihedral Engineering (Canada). Long track record in water/wastewater, utilities, and municipal infrastructure. Includes historian, trend viewer, alarm notification, and ~50 built-in driver protocols under a single license.

**Target Market:** Water/wastewater utilities, municipalities, small-to-mid-size industrial facilities, oil & gas pipelines.

**Key Strengths:**
- All-in-one: historian, trends, alarms, reports, drivers, thin client — one install, one license
- First 50 tags free forever; low-cost entry for small deployments
- Perpetual, per-PC licensing with no per-tag cost above the tier threshold
- Alarm notification via SMS, email, and text-to-speech phone calls — built in
- Frequent updates (bi-weekly release cycle); responsive support
- Strong thin-client story: smartphones and tablets as concurrent web clients, licensed per concurrent user

**Key Weaknesses:**
- Windows-only; no Linux/ARM/embedded deployment
- Limited web-based development: design environment is a Windows desktop application
- UI/UX is dated compared to modern web-native platforms
- Less integrator ecosystem than Ignition; smaller community

**Pricing:**
- Tag-count-based perpetual licenses; first 50 tags free
- Thin-client concurrent user licenses priced separately
- No public list pricing beyond the free tier; contact Trihedral for quotes

**X-HMI vs. VTScada:** VTScada's alarm notification system (SMS/email/phone) and its all-in-one licensing are notable. X-HMI's Linux/ARM deployment on PLCnext is a strong differentiator where VTScada cannot run. X-HMI's web IDE vs. VTScada's Windows designer is a meaningful advantage for modern workflows.

---

### 1.9 mySCADA (myPRO)

**Overview:** Czech-developed, web-based SCADA/HMI platform. myPRO is the desktop/server edition; myBOX is a hardware appliance combining an industrial router with a built-in mySCADA server. Positions on ease of setup and attractive pricing for SME industrial users.

**Target Market:** SME manufacturers, machine builders in Europe, building automation, small-scale process monitoring.

**Key Strengths:**
- Genuinely web-based: browser-based designer and runtime, no desktop install required
- Fast setup: myBOX plug-and-play hardware appliance ready in minutes
- Competitive pricing — marketed as "full SCADA for less than €1,000"
- VPN and HTTPS security baked in to myBOX appliance
- Supports OPC-UA, Modbus, MQTT, BACnet, and others
- Hardware bundles (myPANEL, myBOX) for integrated deployments

**Key Weaknesses:**
- Smaller community and integrator ecosystem than Ignition or AVEVA
- Limited scalability for very large tag counts or enterprise multi-site deployments
- CISA has published ICS security advisories against mySCADA myPRO (ICSA-24-184-02), raising concerns about vulnerability management maturity
- Relatively thin alarm management compared to ISA-18.2-aligned products
- European-centric support; North American support responsiveness varies

**Pricing:**
- myPRO: marketed under €1,000 for full SCADA entry; exact per-tag/per-user pricing on pricing page
- myBOX hardware appliance: separate hardware cost

**X-HMI vs. mySCADA:** mySCADA is the closest direct market analog — a modern, web-based, affordable HMI/SCADA targeting SME industrial users on specific hardware. Key competitive differentiator: X-HMI's first-class PLCnext integration (pxc_api, GDS, ARM64 native binary) vs. mySCADA's generic protocol approach. X-HMI's embedded binary (zero runtime dependency) is also a deployment advantage over mySCADA's server process model.

---

## 2. X-HMI Positioning Summary

| Dimension | X-HMI Today |
|---|---|
| **Deployment model** | Single ARM64 Go binary; runs on PLCnext AXC F 3152; zero external runtime |
| **IDE** | Web-based drag-and-drop canvas; no desktop install required |
| **Protocols** | OPC-UA, Modbus TCP, MQTT, REST/pxc_api |
| **Historian** | SQLite-backed; trend + history widgets |
| **Alarms** | Rules engine (threshold); ACK; WebSocket push |
| **Tag streaming** | Real-time WebSocket |
| **Widget set** | 11 types: gauge, trend, LED, button, tank, setpoint, numeric display/input, text display/input, history log |
| **Target** | Phoenix Contact PLCnext AXC F 3152; embedded single-controller HMI |
| **Pricing** | Not yet defined (pre-commercial) |

**Positioning statement:** X-HMI is the purpose-built, zero-dependency HMI for Phoenix Contact PLCnext controllers — deployed as a single ARM64 binary, configured from a browser IDE, and connected to OPC-UA, Modbus, MQTT, and the PLCnext native REST API. It closes the gap between the bare-bones eHMI included with PLCnext Engineer and the over-engineered complexity of enterprise platforms like Ignition and AVEVA.

---

## 3. Where X-HMI Leads

These are genuine competitive advantages over one or more competitors today:

### 3.1 Zero-Dependency ARM64 Binary Deployment
A single Go binary cross-compiled for ARM64 runs the IDE server, runtime, historian, and alarm engine in one process. No JVM (Ignition), no Node.js runtime (Node-RED), no .NET (WinCC), no separate database process. This is a decisive advantage on memory-constrained edge hardware like the AXC F 3152.

### 3.2 Browser-Based IDE — No Engineering Workstation Install
The drag-and-drop canvas IDE is served from the runtime binary itself. No desktop application to install or license separately (unlike Ignition Designer, WinCC Studio, VTScada Designer, AVEVA Development Studio). Any browser on the LAN can open the IDE.

### 3.3 Native PLCnext Integration via pxc_api
X-HMI speaks the PLCnext REST API natively. No separate OPC-UA server configuration is required for PLCnext variable access. Competitors (Ignition, mySCADA, Grafana) must configure OPC-UA or Modbus bridges to reach PLCnext GDS variables; X-HMI has a first-class native path.

### 3.4 Multi-Protocol in One Product
OPC-UA + Modbus TCP + MQTT + REST in a single binary, all natively configured from the IDE. Competitors at this price point typically require paid add-on modules for additional protocols (Ignition), external gateway middleware (Grafana, Home Assistant), or offer limited protocol breadth (eHMI supports only GDS binding).

### 3.5 Integrated Alarm Engine with WebSocket Push
Real-time alarm state pushed over WebSocket to connected clients. At this tier, many competitors (Node-RED Dashboard, Grafana, mySCADA basic tier, eHMI) either lack alarm management entirely or require separate alarm server configuration.

### 3.6 Embedded Historian with Trend Widget
SQLite historian co-located with the runtime — no separate InfluxDB, TimescaleDB, or Historian Server needed. Grafana requires an external time-series database. Ignition requires the Tag Historian module.

### 3.7 IDE-to-Runtime Deploy Workflow
HTTP API-driven deploy from IDE to runtime is a modern developer experience. Changes are pushed without restarting the binary or rebooting the controller — comparable to Ignition's "Save & Publish" but without the gateway complexity.

---

## 4. Competitive Gaps — What X-HMI Lacks

Ranked by impact and frequency of competitor advantage:

### Priority 1 — Critical Gaps (blockers for serious adoption)

| Gap | Who Has It | Why It Matters |
|---|---|---|
| **Role-based access control (RBAC)** | All major competitors | Without operator vs. engineer vs. admin roles, X-HMI cannot be deployed in any facility with multiple personnel. ISA-18.2 and basic OT security require it. |
| **Alarm notification (email/SMS)** | Ignition, VTScada, AVEVA, mySCADA | Alarms visible only in the operator panel are insufficient. On-call engineers need push notification when they are not watching the screen. |
| **User authentication** | All competitors | No login = no production deployment. Even eHMI has basic HTTP auth. RBAC requires authentication as a prerequisite. |
| **Project versioning / backup-restore** | Ignition, AVEVA, VTScada | Without version control, a misconfigured deploy destroys the previous working project with no recovery path. |

### Priority 2 — Significant Gaps (limit competitiveness)

| Gap | Who Has It | Why It Matters |
|---|---|---|
| **Tag UDT / template/type system** | Ignition (UDTs), AVEVA (Object Derivation) | Scaling beyond ~50 tags without a type system creates unmaintainable flat tag lists. Ignition's UDTs are cited as a top differentiator. |
| **Calculated / derived tags** | Ignition, AVEVA, WinCC, VTScada | Tags like "efficiency = good_parts / total_parts" or unit conversions must be done in the PLC today. A tag expression engine in X-HMI would eliminate round-trips. |
| **Mobile-responsive operator panel** | Ignition (Perspective), AVEVA (OMI), mySCADA | Fixed-resolution canvas cannot adapt to phone/tablet screens. Operators increasingly use mobile devices for remote monitoring. |
| **Alarm history log with filtering** | All major SCADA platforms | Current alarms ≠ alarm history. ISA-18.2 requires a searchable, filterable, exportable alarm journal. |
| **Report generation** | Ignition (Reporting module), AVEVA, VTScada | Shift reports, OEE summaries, and compliance reports are required in most manufacturing environments. |
| **Multi-controller / aggregation** | Ignition, AVEVA, WinCC OA | X-HMI is currently 1:1 (one runtime per controller). Facilities with multiple PLCnext controllers need a unified operator view. |

### Priority 3 — Desirable Gaps (differentiation opportunities)

| Gap | Who Has It | Why It Matters |
|---|---|---|
| **Trend annotation / event marking** | Grafana, Ignition | Correlating alarms or production events with trend data is a key diagnostic workflow. |
| **Dashboard sharing / read-only public URL** | Grafana, Home Assistant | Enable read-only views for supervisors or external auditors without giving them full operator access. |
| **REST API for external integration** | Ignition, AVEVA | Expose X-HMI tag values and alarm state via REST so MES, ERP, or cloud systems can consume data. |
| **Audit trail / operator event log** | AVEVA, Ignition, WinCC | Log every setpoint write, alarm ACK, and login event with timestamp and username for compliance. |
| **CSV/Excel export from historian** | VTScada, Ignition, Grafana | Maintenance and quality engineers need to pull trend data into Excel for analysis. |
| **Container / Docker deployment** | Grafana, Node-RED, mySCADA (myBOX uses containers) | PLCnext supports Docker via the PLCnext Store. A container image would simplify distribution. |
| **PROFINET / EtherNet/IP protocol support** | WinCC, Ignition (via module), AVEVA | Broadens addressable hardware beyond Modbus and OPC-UA. |
| **Built-in VPN / secure remote access** | mySCADA (myBOX), VTScada | Remote monitoring without requiring the facility to open firewall ports is a common request. |

---

## 5. Top 10 High-Impact Features to Add Next

Ranked by the combination of: competitive gap severity, frequency of user need in target market, and implementation feasibility given the existing Go + React architecture.

---

### #1 — User Authentication and Role-Based Access Control

**What:** Login screen with username/password (bcrypt, session tokens/JWT). Roles: `admin` (full IDE + runtime), `operator` (runtime only, write-capable), `viewer` (read-only runtime).

**Why:** This is a hard blocker. No facility can deploy X-HMI in a multi-user environment without it. Every competitor has it. It is also the prerequisite for the audit trail, alarm notification, and project management features below.

**Competitive reference:** Ignition roles/zones, mySCADA user management, VTScada concurrent-user model.

---

### #2 — Alarm Notification (Email / Webhook)

**What:** When an alarm fires (or clears), send an email and/or POST to a configurable webhook URL. Email via SMTP (configurable relay); webhook for integration with PagerDuty, Teams, Slack, etc.

**Why:** Alarms that only display on-screen are of limited operational value. On-call engineers need to be notified. This is a top-cited feature across all SCADA reviews. Lightweight to implement — Go's `net/smtp` and an HTTP client require minimal code.

**Competitive reference:** VTScada (SMS/email/phone), Ignition alarm pipelines, AVEVA notification server.

---

### #3 — Project Versioning and Backup/Restore

**What:** Snapshot the current project (canvas layout, tag configuration, alarm rules) to a timestamped file on disk. Allow restore from a prior snapshot via the IDE. Optionally, auto-snapshot on each deploy.

**Why:** A single misconfigured deploy currently destroys the running project with no recovery path. This is a production-safety requirement. Ignition's Designer tracks versions; AVEVA has project revision history.

**Implementation note:** The Go binary already serializes project state to JSON/SQLite — wrapping this in a snapshot/restore API is straightforward.

---

### #4 — Calculated / Derived Tags (Expression Engine)

**What:** Allow tags to be defined by expressions referencing other tags: `{motor_speed} * 0.10472` (RPM → rad/s), `({good_parts} / {total_parts}) * 100` (yield %), `{tank_level} > 80 ? "HIGH" : "OK"`. Evaluate in the Go runtime on each scan cycle.

**Why:** Without this, every derived value must be computed in the PLC program or via a separate calculation layer. This is a top differentiator of Ignition (calculated tags) and AVEVA (attribute expressions) and is cited frequently by industrial engineers.

---

### #5 — Mobile-Responsive Runtime Panel

**What:** The operator runtime panel should reflow to smaller screens. At minimum: a single-column stacking layout for screens under 768px, with touch-friendly widget sizing. Full responsive design (auto-scaling canvas or Flexbox-based layout) is the stretch goal.

**Why:** Ignition Perspective and AVEVA OMI both offer "build once, deploy anywhere" responsive design. Operators and supervisors increasingly use tablets and phones for walk-around monitoring. A fixed-resolution canvas is a significant limitation for any deployment beyond a single panel-mounted screen.

---

### #6 — Alarm History Journal

**What:** Persist every alarm state transition (active, acknowledged, cleared) to SQLite with timestamp, tag name, value at trigger, rule description, and acknowledging user. Surface via a filterable, sortable Alarm History widget in the IDE/runtime. Export to CSV.

**Why:** Real-time alarm display shows current state. Alarm history is required for incident investigation, ISA-18.2 alignment, and regulatory compliance in food, pharma, and water sectors. VTScada, Ignition, AVEVA, and WinCC all provide alarm journals as table-stakes features.

---

### #7 — Multi-Controller Tag Aggregation

**What:** Allow a single X-HMI runtime to connect to multiple PLCnext controllers (or any mix of OPC-UA, Modbus, MQTT sources) and display tags from all sources on a unified canvas.

**Why:** Even small facilities often have 2–4 PLCs. A 1:1 HMI-to-controller model forces separate operator screens per controller and prevents unified dashboards. This is a fundamental scalability step. Ignition's gateway model, AVEVA System Platform, and WinCC all support multi-controller aggregation as core architecture.

**Note:** X-HMI's existing multi-protocol support already handles heterogeneous sources — this is primarily a UI/project model change to allow multiple named data source connections.

---

### #8 — Tag Import from PLCnext Engineer Project (XML/CSV)

**What:** Parse a PLCnext Engineer exported tag list (PLCnext variable export XML or CSV) and auto-populate X-HMI's tag database, pre-configured with correct data types and GDS paths.

**Why:** Manual re-entry of 50–500 PLC tags into an HMI tool is error-prone and time-consuming — a leading pain point in HMI commissioning. Ignition imports from PLC export files; AVEVA uses object templates. For X-HMI's PLCnext-native positioning, a one-click import from PLCnext Engineer output is a high-value differentiator that is uniquely enabled by the PLCnext focus.

---

### #9 — Operator Audit Trail

**What:** Log every write operation (setpoint change, button press), alarm acknowledgment, and user login/logout event to a tamper-evident audit table in SQLite. Viewable and exportable from the IDE.

**Why:** Regulatory frameworks (FDA 21 CFR Part 11, ISO 9001, food safety) require that operator actions on controlled processes be logged with timestamp, username, and value. This is a gating requirement for pharmaceutical, food & beverage, and water/wastewater deployments. Requires RBAC (#1) as a prerequisite.

---

### #10 — Docker / OCI Container Image for PLCnext Store Distribution

**What:** Package X-HMI as an OCI-compliant container image. Publish to the PLCnext Store so users can install X-HMI on their AXC F 3152 with a single click from the Phoenix Contact app store.

**Why:** PLCnext Technology supports Docker containers natively on AXC F 3152 (via the PLCnext Store infrastructure). Publishing X-HMI to the PLCnext Store creates a zero-friction distribution channel within the existing Phoenix Contact ecosystem — directly in front of the target customer without requiring manual binary transfer and installation. mySCADA uses containers in its myBOX product; Grafana and Node-RED are both available as containers. This also positions X-HMI as a first-class PLCnext Store app alongside other ecosystem tools.

---

## Appendix — Competitive Summary Matrix

| Feature | X-HMI | Ignition | AVEVA | WinCC Unified | eHMI | Grafana | Node-RED | VTScada | mySCADA |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Web-based IDE | ✅ | ❌ (desktop) | ❌ (desktop) | ❌ (desktop) | ❌ (in PLCnext Eng.) | ✅ | ✅ | ❌ | ✅ |
| ARM64 / Linux deployment | ✅ | ✅ (Edge) | ❌ | ❌ | ✅ (on controller) | ✅ | ✅ | ❌ | Partial |
| Zero external runtime deps | ✅ | ❌ (JVM) | ❌ | ❌ | ✅ | ❌ (DB required) | ❌ (Node.js) | ❌ | ❌ |
| OPC-UA | ✅ | ✅ | ✅ | ✅ | ❌ | Plugin | Plugin | ✅ | ✅ |
| Modbus TCP | ✅ | ✅ | ✅ | ✅ | ❌ | Plugin | Plugin | ✅ | ✅ |
| MQTT | ✅ | ✅ | ✅ | ✅ | ❌ | Plugin | ✅ | Partial | ✅ |
| PLCnext native API | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | Plugin | ❌ | ❌ |
| Integrated historian | ✅ | Module | ✅ | ✅ | ❌ | ❌ (ext. DB) | ❌ | ✅ | ✅ |
| Alarm engine + ACK | ✅ | ✅ | ✅ | ✅ | ❌ | Alerting only | ❌ | ✅ | ✅ |
| Alarm notification (email/SMS) | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| User auth / RBAC | ❌ | ✅ | ✅ | ✅ | Basic | ✅ | ❌ | ✅ | ✅ |
| Calculated / derived tags | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Partial | ✅ | Partial |
| Mobile-responsive runtime | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alarm history journal | ❌ | ✅ | ✅ | ✅ | ❌ | Partial | ❌ | ✅ | ✅ |
| Multi-controller aggregation | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Project versioning | ❌ | ✅ | ✅ | ✅ | ❌ | N/A | ❌ | ✅ | Partial |
| Write-back to PLC | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Container / PLCnext Store | ❌ | ❌ | ❌ | ❌ | N/A | ✅ | ✅ | ❌ | Partial |
| Audit trail | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | Partial |
| **Open-source / free** | TBD | ❌ | ❌ | ❌ | ✅ | ✅ (OSS) | ✅ | Partial | ❌ |

---

*Analysis based on publicly available product documentation, pricing pages, user reviews (G2, Capterra, Gartner Peer Insights, SourceForge), and community forums as of May 2026. Pricing figures are approximations; contact vendors for current quotes.*
