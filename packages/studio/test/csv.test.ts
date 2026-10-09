import { describe, expect, it } from "vitest";
import { parseAgenda, parseAttendees } from "../src/csv";

// Exportación de Microsoft Forms con nombres ficticios: nombre completo, correo y pregunta de asistencia
const FORMS = `Id,Hora de inicio,Hora de finalización,Correo electrónico,Nombre,"Considerando lo arriba descrito, ¿te sumas a participar?"
1,2026-10-01,2026-10-01,lucia.herrera@ejemplo.com,Lucía Herrera,"Sí, de forma presencial"
2,2026-10-01,2026-10-01,tomas.paz@ejemplo.com,Tomás Paz Ríos,"Sí, de forma remota"
3,2026-10-01,2026-10-01,ana.gil@ejemplo.com,Ana Gil,No
4,2026-10-02,2026-10-02,LUCIA.HERRERA@ejemplo.com,Lucía Herrera,"Sí, de forma presencial"`;

describe("parseAttendees", () => {
  const people = parseAttendees(FORMS);

  it("separa el nombre completo en nombre y apellido", () => {
    expect(people[0]).toMatchObject({ firstName: "Lucía", lastName: "Herrera" });
    expect(people[1]).toMatchObject({ firstName: "Tomás", lastName: "Paz Ríos" });
  });

  it("lee la asistencia y deja afuera a quien dijo que no", () => {
    expect(people.map((p) => p.attendance)).toEqual(["presencial", "remoto"]);
    expect(people.find((p) => p.firstName === "Ana")).toBeUndefined();
  });

  it("descarta respuestas duplicadas por correo", () => {
    expect(people).toHaveLength(2);
  });

  it("acepta columnas nombre y apellido separadas", () => {
    expect(parseAttendees("nombre,apellido,area\nSofía,González,Diseño")).toEqual([
      { firstName: "Sofía", lastName: "González", area: "Diseño", role: undefined, email: undefined, attendance: undefined },
    ]);
  });
});

describe("parseAgenda", () => {
  it("lee bloques escritos a mano", () => {
    expect(parseAgenda("9:30 - 10:30 Charla de apertura | Auditorio\n11:00 Workshops")).toEqual([
      { start: "9:30", end: "10:30", title: "Charla de apertura", room: "Auditorio", speaker: undefined },
      { start: "11:00", end: undefined, title: "Workshops", room: undefined, speaker: undefined },
    ]);
  });
});
