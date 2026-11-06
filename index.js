// Entrada de la app. `registroGps` va primero: define la tarea de ubicación del viaje al cargar el bundle, también
// cuando Android relanza solo el JS (sin montar la app); si no, expo-task-manager da de baja la tarea.
import './src/features/logistica/gps/registroGps'
import 'expo-router/entry'
