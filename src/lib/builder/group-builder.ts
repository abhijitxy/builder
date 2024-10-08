import type { LayoutBuilder } from "@tscircuit/layout"
import type * as Type from "lib/types"
import _ from "lodash"
import * as CB from "./component-builder"
import { createViaBuilder } from "./component-builder/ViaBuilder"
import { createNetBuilder, type NetBuilder } from "./net-builder/net-builder"
import type { ProjectBuilder } from "./project-builder"
import type { TraceBuilder, TraceBuilderCallback } from "./trace-builder"
import { createTraceBuilder } from "./trace-builder"
import {
  createTraceHintBuilder,
  type TraceHintBuilder,
} from "./trace-hint-builder"

export const getGroupAddables = () =>
  ({
    generic_component: CB.createComponentBuilder,
    component: CB.createComponentBuilder,
    resistor: CB.createResistorBuilder,
    net_alias: CB.createNetAliasBuilder,
    capacitor: CB.createCapacitorBuilder,
    diode: CB.createDiodeBuilder,
    led: CB.createLedBuilder,
    power_source: CB.createPowerSourceBuilder,
    inductor: CB.createInductorBuilder,
    ground: CB.createGroundBuilder,
    bug: CB.createBugBuilder,
    trace: createTraceBuilder,
    via: createViaBuilder,
    group: createGroupBuilder,
    trace_hint: createTraceHintBuilder,
    net: createNetBuilder,
  } as const)

export type GroupBuilderAddables = ReturnType<typeof getGroupAddables>

export type GroupBuilderCallback = (gb: GroupBuilder) => unknown
export interface GroupBuilder {
  project_builder: ProjectBuilder
  builder_type: "group_builder" | "board_builder"
  addables: GroupBuilderAddables
  reset: () => GroupBuilder
  setName: (name: string) => GroupBuilder
  setProps: (props: any) => GroupBuilder
  appendChild(
    child: CB.ComponentBuilder | GroupBuilder | TraceBuilder
  ): GroupBuilder
  addGroup(
    groupBuilderCallback: GroupBuilderCallback | GroupBuilder
  ): GroupBuilder
  addComponent(
    componentBuilderCallback: CB.GenericComponentBuilderCallback
  ): GroupBuilder
  addResistor(resistorBuilderCallback: CB.ResistorBuilderCallback): GroupBuilder
  addCapacitor(
    capacitorBuilderCallback: CB.CapacitorBuilderCallback
  ): GroupBuilder
  addDiode(diodeBuilderCallback: CB.DiodeBuilderCallback): GroupBuilder
  addBug(bugBuilderCallback: CB.BugBuilderCallback): GroupBuilder
  addPowerSource(
    powerSourceBuilderCallback: CB.PowerSourceBuilderCallback
  ): GroupBuilder
  addInductor(
    powerSourceBuilderCallback: CB.InductorBuilderCallback
  ): GroupBuilder
  addGround(groundBuilderCallback: CB.GroundBuilderCallback): GroupBuilder
  addTrace: (
    traceBuiderCallback: TraceBuilderCallback | string[]
  ) => GroupBuilder
  add<T extends keyof GroupBuilderAddables>(
    builder_type: T,
    callback: (builder: ReturnType<GroupBuilderAddables[T]>) => unknown
  ): GroupBuilder
  build(build_context: Type.BuildContext): Promise<Type.AnyElement[]>
}

export class GroupBuilderClass implements GroupBuilder {
  builder_type: "group_builder" | "board_builder" = "group_builder"
  groups: GroupBuilder[]
  components: CB.BaseComponentBuilder<any>[]
  traces: TraceBuilder[]
  nets: NetBuilder[]
  trace_hints: TraceHintBuilder[]
  project_builder: ProjectBuilder
  name: string
  addables: GroupBuilderAddables
  auto_layout?: { schematic: true }
  manual_layout?: Type.ManualLayout
  layout_builder?: LayoutBuilder
  routingDisabled?: boolean

  constructor(project_builder?: ProjectBuilder) {
    this.project_builder = project_builder!
    this.addables = getGroupAddables()
    this.reset()
  }

  reset() {
    this.groups = []
    this.components = []
    this.traces = []
    this.trace_hints = []
    this.nets = []
    return this
  }
  add(new_builder_type, callback) {
    if (!this.addables[new_builder_type]) {
      // console.log(
      //   Object.keys(this.addables),
      //   new_builder_type,
      //   this.addables[new_builder_type],
      //   new_builder_type in this.addables,
      //   CB
      // )
      throw new Error(
        `No addable in group builder for builder_type: "${new_builder_type}"`
      )
    }
    const new_builder = this.addables[new_builder_type](this.project_builder)
    callback(new_builder as any) // not smart enough to infer generic
    this.appendChild(new_builder)
    return this
  }
  setName(name) {
    this.name = name
    return this
  }
  setProps(props) {
    if (props.name) {
      this.setName(props.name)
    }
    if (props.auto_schematic_layout) {
      this.auto_layout = { schematic: true }
    }
    if (props.manual_layout) {
      this.manual_layout = props.manual_layout
    }
    if (props.layout) {
      this.layout_builder = props.layout
    }
    if (props.routingDisabled !== undefined) {
      this.routingDisabled = props.routingDisabled
    }
    return this
  }
  appendChild(child) {
    if (
      [
        "schematic_symbol_builder",
        "schematic_box_builder",
        "schematic_line_builder",
        "schematic_text_builder",
      ].includes(child.builder_type)
    ) {
      throw new Error(
        `Schematic primitives can't be added to a group builder (try adding to a component)`
      )
    }

    // TODO just make this children?
    if (
      child.builder_type === "group_builder" ||
      child.builder_type === "board_builder"
    ) {
      this.groups.push(child as any)
    } else if (child.builder_type === "trace_builder") {
      this.traces.push(child as any)
    } else if (child.builder_type === "trace_hint_builder") {
      this.trace_hints.push(child as any)
    } else if (child.builder_type === "net_builder") {
      this.nets.push(child as any)
    } else if (this.addables[child.builder_type.split("_builder")[0]]) {
      this.components.push(child as any)
    } else {
      throw new Error(
        `Unknown builder type for appendChild: "${child.builder_type}"`
      )
    }
    return this
  }
  addGroup(gb) {
    return this.add("group", gb)
  }
  addPowerSource(cb) {
    return this.add("power_source", cb)
  }
  addComponent(cb) {
    return this.add("component", cb)
  }
  addResistor(cb) {
    return this.add("resistor", cb)
  }
  addCapacitor(cb) {
    return this.add("capacitor", cb)
  }
  addBug(cb) {
    return this.add("bug", cb)
  }
  addDiode(cb) {
    return this.add("diode", cb)
  }
  addInductor(cb) {
    return this.add("diode", cb)
  }
  addGround(cb) {
    return this.add("ground", cb)
  }
  addTrace(tb) {
    if (typeof tb !== "function") {
      const portSelectors = tb as string[]
      tb = (rb) => {
        rb.addConnections(portSelectors)
      }
    }
    const builder = createTraceBuilder(this.project_builder)
    this.traces.push(builder)
    tb(builder)
    return this
  }

  async build(bc: Type.BuildContext): Promise<Type.AnyElement[]> {
    let elements: Type.AnyElement[] = []
    elements.push(
      ..._.flatten(await Promise.all(this.groups.map((g) => g.build(bc))))
    )
    elements.push(
      ..._.flatten(await Promise.all(this.components.map((c) => c.build(bc))))
    )

    const routingDisabled = this.routingDisabled || false

    if (this.layout_builder) {
      elements = this.layout_builder.applyToSoup(elements as any, bc) as any
    }

    elements.push(
      ..._.flatten(
        await Promise.all(this.trace_hints.map((c) => c.build(elements, bc)))
      )
    )

    // Find any inferred nets from trace paths that aren't represented
    const explicit_net_names = this.nets.map((n) => n.props.name)
    const implicit_net_names: string[] = []
    for (const trace of this.traces) {
      const trace_net_names = trace.getNetNames()
      implicit_net_names.push(
        ...trace_net_names.filter(
          (n) =>
            !explicit_net_names.includes(n) && !implicit_net_names.includes(n)
        )
      )
    }

    const implicit_net_builders = implicit_net_names.map((n) =>
      createNetBuilder(this.project_builder).setProps({ name: n })
    )

    elements.push(
      ..._.flatten(
        this.nets.concat(implicit_net_builders).map((n) => n.build(bc))
      )
    )

    // TODO parallelize by dependency (don't do traces with the same net at the
    // same time)

    // HACK we should really combine traces with the same net into a single
    // trace builder rather than having each trace manage connecting itself
    // to the net
    const net_name_to_source_port_ids: Record<string, string[]> = {}
    for (const net of this.nets) {
      net_name_to_source_port_ids[net.props.name!] = []
      for (const trace of this.traces) {
        const connections = trace.getConnections()
        const { source_ports_in_route } =
          await trace.getSourcePortsAndNetsInRoute(elements)
        for (const conn of connections) {
          if (
            conn === `.${net.props.name}` ||
            conn === `net.${net.props.name}`
          ) {
            net_name_to_source_port_ids[net.props.name!].push(
              ...source_ports_in_route.map((p) => p.source_port_id!)
            )
          }
        }
      }
    }
    bc.source_ports_for_nets_in_group = net_name_to_source_port_ids

    for (const trace of this.traces) {
      const traceElements = await trace.build(elements, bc)
      elements.push(
        ...traceElements.filter(
          (el) =>
            !routingDisabled ||
            (el.type !== "pcb_trace" && el.type !== "pcb_via")
        )
      )
    }

    return elements
  }
}

/**
 * This uses an old construction pattern that's been tested.
 */
export function createGroupBuilder(
  project_builder?: ProjectBuilder
): GroupBuilder {
  const gb = new GroupBuilderClass(project_builder)
  return gb
}
