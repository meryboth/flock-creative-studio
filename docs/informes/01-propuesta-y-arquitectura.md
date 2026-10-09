# 01 · Propuesta y arquitectura

**Fecha:** 2026-10-09

## El problema

Flock IT hace uno o dos eventos internos grandes por año (AI Day, Outdoor). Para cada uno, People Experience define una temática y le encarga a la agencia BrandBox la identidad y las piezas: posteos, cronograma, credenciales, certificados. El proceso es lento, caro y deja poco margen para iterar.

**Objetivo:** que cualquier flocker que organice un evento pueda definir el evento y un estilo, y obtener una familia de piezas lista para publicar e imprimir, sin pasar por la agencia.

## Cómo evolucionó la propuesta

1. **v0.1 · Orquestador genérico.** Un grafo de agentes (analista de brief → director creativo → copywriter → generador visual → compositor → QA) sobre Next.js + LangGraph, todo local salvo la API del LLM.
2. **v0.2 · Primero la identidad, después las piezas.** Al analizar las piezas reales del AI Day 2026 vimos que un evento no es un conjunto de imágenes sueltas, sino **un sistema**: un key visual, una paleta, dos tipografías, unos pocos componentes (la pastilla de la fecha, la caja con contorno) y constantes (logo, hashtag, frase). De ahí salió el concepto de **Event Kit**: se define una vez y se aplica a todas las plantillas.
3. **v0.3 · Código primero** (ver [informe 05](05-codigo-primero.md)). Las piezas y sus variantes se generan con código; la IA solo escribe textos e interpreta pedidos.

## Principio rector

> **La IA de imágenes no escribe texto ni dibuja el logo.**

Los modelos generativos fallan con tipografías, logos y colores exactos. La composición final la hace código determinístico con plantillas; así cada pieza cumple la marca siempre.

## Arquitectura

```
Next.js (UI + API)  ──►  motor de generación (@flock/studio)
                              │
          ┌───────────────────┼─────────────────────┐
          ▼                   ▼                     ▼
  @flock/templates     @flock/renderer        @flock/agents
  estilos, paletas,    Playwright:            textos (Gemini),
  plantillas React     HTML → PNG / PDF       análisis de moodboard
          │
          ▼
  PostgreSQL + pgvector (OrbStack) · storage/ local · brand/ (marca)
```

| Paquete | Responsabilidad |
|---|---|
| `apps/web` | La herramienta: crear eventos, elegir estilo, ver y descargar piezas |
| `packages/templates` | Event Kit, catálogo de estilos, paletas, visuales generativos y plantillas de cada pieza |
| `packages/renderer` | Un Chromium headless reutilizado que convierte HTML en PNG y PDF |
| `packages/agents` | Todo lo que usa IA o análisis: redacción con Gemini, lectura de colores del moodboard |
| `packages/studio` | Orquesta la generación de una familia completa y su control de calidad |
| `packages/db` | Esquema Drizzle, migraciones y carga del brand kit |

## Restricción: todo local

Base de datos, archivos, render y cola corren en la Mac. La única dependencia externa es la API del LLM, encapsulada para poder cambiarla por un modelo local (Ollama).
