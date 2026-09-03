# Bot de WhatsApp

Paquete de desarrollo/demostración. Corre con Baileys pero el motor no depende de Baileys ni de Prisma.

```bash
pnpm install
Copy-Item .env.example .env
pnpm --filter @turnero-jp/whatsapp-bot dev
```

Escaneá el QR que aparece en la terminal con el número de prueba. La carpeta de sesión se guarda en `.data/` y está excluida de Git. Para el flujo real, implementar `AppointmentGateway` con los casos de uso compartidos de Fase 3.
