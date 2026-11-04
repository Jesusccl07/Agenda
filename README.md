# 🎧 Turnos DJ

App móvil (PWA) con los turnos, cachés e ingresos de **CLEMENT** y **DJ Bota**, leyendo y escribiendo en el calendario «Nexora» de Google Calendar. Funciona sin conexión.

Ábrela en: https://jesusccl07.github.io/Agenda/turnos/

(La dirección https://jesusccl07.github.io/Agenda/ también lleva directamente a Turnos DJ.)

- Al abrir eliges agenda (CLEMENT o DJ Bota). Los turnos marcados como *Two Generation's* salen en las dos.
- Panel de administración con estilo *Liquid Glass*: paneles de cristal sobre luces de sala animadas (cian y violeta para CLEMENT, naranja y magenta para DJ Bota).
- Cifras con minigráficas y comparación con el periodo anterior (este mes, este año o todo): ingresos, turnos, horas en cabina y caché medio.
- Próximo turno con cuenta atrás en directo, próximos 7 días, gráfico de ingresos por mes (cobrado y previsto), tabla de turnos con buscador, calendario con alta rápida («DJ LA CLUB»: viernes 80 €, sábado 100 €), ranking de locales que más pagan y objetivo del mes.
- Añadir, modificar y borrar turnos desde la app: se guardan en Google Calendar. Sin internet se guardan en el móvil y se envían al reconectar.
- Se actualiza sola cada minuto con la app abierta.
- Cada turno usa en la descripción del evento el formato `🎤 DJ: … / 📍 Lugar / 🏢 Local / 💰 Caché / ⏰ Horario / 🕐 Duración / 🎒 Llevar`.

## Usarla con otra cuenta de Google (por ejemplo, la de tu padre)
Cada móvil inicia sesión con su propia cuenta y desde *Ajustes → Cambiar de cuenta* se puede pasar a otra. Para que otra cuenta funcione:

1. **Comparte el calendario Nexora** con esa cuenta: Google Calendar (en el ordenador) → Nexora → *Configuración y uso compartido* → *Compartir con determinadas personas* → añade su correo con el permiso **«Hacer cambios en eventos»**. Esa persona tiene que aceptar la invitación del correo.
2. **Autoriza la cuenta en la app de Google**: si en Google Cloud Console la pantalla de consentimiento está en modo *Prueba* (Testing), añade su correo en *Google Auth Platform → Público (Audience) → Usuarios de prueba*. Si no, Google le mostrará «Acceso bloqueado».
3. En su móvil abre el enlace, elige agenda, pulsa *Iniciar sesión con Google* y elige su cuenta. Si Google avisa de que la app no está verificada: *Configuración avanzada → Ir a…*.

Permisos que pide al iniciar sesión con Google: ver y editar eventos de calendario, ver la lista de calendarios y tu nombre/correo.

## Instalarla como app
Abre el enlace en Safari (iPhone) o Chrome (Android) → *Añadir a pantalla de inicio*.
