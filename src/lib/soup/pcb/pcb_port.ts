import { z } from "zod"
import { distance } from "../units"
import { layer_ref } from "./layer_ref"

export const pcb_port = z
  .object({
    type: z.literal("pcb_port"),
    pcb_port_id: z.string(),
    source_port_id: z.string(),
    x: distance,
    y: distance,
    layers: z.array(layer_ref),
  })
  .describe("Defines a port on the PCB")

export type PCBPortInput = z.input<typeof pcb_port>
export type PCBPort = z.infer<typeof pcb_port>
