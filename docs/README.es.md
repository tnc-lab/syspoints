# Syspoints ⠎⠽⠎⠏⠕⠊⠝⠞⠎

![Syspoints](https://i.ibb.co/fY7fhskW/syspoints-banner.png)

| [🇺🇸 English](../README.md) | 🇪🇸 Español | [🇧🇷 Português](README.pt.md)

**Syspoints** es una plataforma de reputación y reseñas basada en blockchain construida sobre **Syscoin**. La misma incentiva a los usuarios con **Tokens Syspoints** por contribuir con reseñas confiables e inmutables a través de un modelo único de **Review-to-Earn**.

## Funciones Clave

- **Reseñas Descentralizadas:** Envíe comentarios inmutables para tiendas y establecimientos directamente en Syscoin NEVM, garantizando la integridad de los datos a través de contratos inteligentes compatibles con Ethereum.
- **Participación Incentivada:** Gane **Tokens Syspoints** como recompensa por reseñas verificadas y de alta calidad.
- **Reputación Transparente:** Aproveche la transparencia de la cadena de bloques para garantizar que todas las calificaciones sean auténticas y a prueba de manipulaciones.

## Documentación del Proyecto 

- **[Arquitectura](architecture.md):** Visión general de la infraestructura del sistema y organización de componentes utilizando **diagramas C4 Container**.
- **[Regras de Negocio](business_rules.md):** Mapeo detallado de los flujos lógicos y las reglas principales que rigen la aplicación mediante **diagramas de flujo**.
- **[Modelo de Datos](data_model.md):** Documentación del esquema de la base de datos con **diagramas de Entidad-Relación (ER)**.
- **[Integración Syscoin](syscoin_integration.md):** Guía técnica sobre protocolos de comunicación blockchain y **diagramas de secuencia de transacciones**.

## Uso

A continuación, se presenta un caso de uso básico de Hardhat. Incluye un contrato de muestra, una prueba para dicho contrato y un módulo Hardhat Ignition que lo implementa.

Intente ejecutar algunas de las siguientes tareas:

```shell
# Muestra un manual del Hardhat
npx hardhat help

# Ejecute pruebas para garantizar que la lógica de revisión funcione
npx hardhat test

# Generar un informe detallado sobre el consumo de gas
REPORT_GAS=true npx hardhat test

# Iniciar un nodo local para el desarrollo
npx hardhat node

# Implementar el contrato Syspoints
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

## Enlaces Útiles

- **Documentación de Red:** [Syscoin Docs](https://docs.syscoin.org)
- **Explorador de Bloques:** [Syscoin Explorer](https://explorer.syscoin.org)

## Licencia

Este proyecto está licenciado bajo la [Licencia MIT](https://opensource.org) - ver el archivo [LICENCIA](../LICENSE) para detalles.