# TechGuessr — Estructura y Convenciones

## Estructura de carpetas (frontend)

```
TechGuessr/
  .kiro/
    steering/         # este directorio
    specs/            # specs de features (requirements/design/tasks)
  docs/
    arquitectura.md    # stack, arquitectura, alcance — documento de referencia principal
    iam-policy.json     # policy de IAM acotada al proyecto
  src/
    app/
      app.ts             # componente raíz
      app.routes.ts       # rutas
      app.config.ts        # configuración de la app (providers)
      features/
        codeguessr/          # lógica y componentes de la modalidad CodeGuessr
      data/
        snippets.json         # dataset curado del MVP
      shared/
        components/            # componentes reutilizables (botones, layout, etc.)
        types/                  # interfaces/tipos compartidos (Snippet, Round, Score...)
  public/               # assets estáticos servidos tal cual
```

Cuando se generen componentes/features nuevos, seguir este patrón por modalidad (`features/{nombre-modalidad}/`) para que agregar StackGuessr/CommitGuessr en el roadmap post-MVP no requiera reestructurar.

## Convenciones de código

- Componentes standalone, sin NgModules.
- Nombres de archivo estilo "2025": `component-name.ts`, `component-name.html`, `component-name.scss` (sin sufijo `.component.`).
- Selector prefix por defecto del scaffold (`app-`), mantenerlo salvo razón concreta para cambiarlo.
- Signals para estado de componente/servicio simple; evitar servicios con estado global innecesario para el tamaño del MVP.
- Un servicio (`*.service.ts` o standalone injectable) por responsabilidad clara: ej. `GameService` para lógica de rondas/puntaje, no mezclar con llamadas HTTP.

## Convenciones de commits y repos

- El repo `TechGuessr` es el que se entrega al jurado (código + README + demo). El repo `Hackathon-Kiro` es solo gestión/documentación del proceso, nunca se entrega como producto.
- Mensajes de commit en español, formato libre pero descriptivo (no se exige conventional commits para este proyecto).
- No hacer commit de `node_modules/`, `.angular/cache/`, `dist/` — ya cubiertos por `.gitignore` del scaffold.
- Nunca commitear credenciales de AWS (access keys, secrets). Si aparecen en algún archivo de configuración local, deben quedar fuera de git.

## Idioma

Documentación y specs en español (mismo idioma que el resto del proyecto y el hackathon). Nombres de código (variables, funciones, clases) en inglés, siguiendo la convención estándar de la comunidad Angular/TypeScript.
