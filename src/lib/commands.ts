export interface CommandResult {
  response: string;
  action?: string;
  data?: Record<string, unknown>;
}

const greetings = [
  'A tu servicio.',
  'Te escucho.',
  'Sistema en línea. ¿En qué puedo ayudarte?',
  'Lista. Dime qué necesitas.',
];

const jokes = [
  '¿Por qué los programadores prefieren el frío? Porque no les gusta el calor humano.',
  '¿Cuál es el animal favorito de un programador? El pýthon.',
  'Un byte entra a un bar y el barman le dice: "Lo siento, no servimos a bits sueltos".',
  '¿Qué le dice un bit a otro bit? Nos vemos en el bus.',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'pm' : 'am';
  const display12 = hours % 12 === 0 ? 12 : hours % 12;
  return `Son las ${display12}:${minutes} ${period}.`;
}

function getDate(): string {
  const now = new Date();
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `Hoy es ${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}.`;
}

const isDesktop = () => typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export async function processCommand(input: string): Promise<CommandResult> {
  const text = input.toLowerCase().trim();

  if (!text) return { response: 'No detecté ningún comando.' };

  // ── Greetings ──
  if (/\b(hola|buenas|hey|saludos|qué tal|que tal)\b/.test(text)) {
    return { response: `Hola. ${pick(greetings)}` };
  }

  if (/\b(quién eres|quien eres|tu nombre|cómo te llamas|como te llamas|qué eres|que eres)\b/.test(text)) {
    return {
      response:
        'Soy ELYRA, tu asistente inteligente de escritorio. Puedo controlar aplicaciones de tu PC, recordar información, abrir carpetas, ejecutar acciones y conversar contigo por voz o texto.',
    };
  }

  if (/\b(qué puedes hacer|que puedes hacer|ayuda|ayúdame|ayudame|funciones|comandos|capacidades)\b/.test(text)) {
    return {
      response:
        'Puedo: abrir aplicaciones (Chrome, VS Code, Spotify, Calculadora…), abrir carpetas (Documentos, Descargas, Escritorio), buscar en internet, decir hora y fecha, hacer cálculos, guardar notas en mi memoria, ejecutar comandos del sistema y conversar. Habla de forma natural.',
    };
  }

  // ── Time / Date ──
  if (/\b(qué hora|que hora|hora es|dime la hora)\b/.test(text)) {
    return { response: getTime() };
  }
  if (/\b(qué fecha|que fecha|qué día|que dia|día es|fecha de hoy)\b/.test(text)) {
    return { response: getDate() };
  }

  // ── Open applications ──
  if (/\b(abre|abrir|ejecuta|lanza|inicia)\b/.test(text) && !/\b(carpeta|folder|documentos|descargas|escritorio)\b/.test(text)) {
    const match = text.match(/(?:abre|abrir|ejecuta|lanza|inicia)\s+(?:la\s+|el\s+|app\s+|aplicación\s+|aplicacion\s+)?(.+)/);
    if (match) {
      const appName = match[1].replace(/\s+(por favor|please)$/i, '').trim();
      // Known websites first
      const sites: Record<string, string> = {
        youtube: 'https://www.youtube.com',
        google: 'https://www.google.com',
        gmail: 'https://mail.google.com',
        github: 'https://github.com',
        twitter: 'https://x.com',
        x: 'https://x.com',
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        wikipedia: 'https://es.wikipedia.org',
        netflix: 'https://netflix.com',
        amazon: 'https://amazon.com',
        noticias: 'https://news.google.com',
      };
      if (sites[appName]) {
        if (isDesktop()) await window.elyra!.openUrl(sites[appName]);
        else window.open(sites[appName], '_blank');
        return { response: `Abriendo ${appName}.`, action: 'open_url' };
      }

      if (isDesktop()) {
        const result = await window.elyra!.openApp(appName);
        return { response: result.message || (result.ok ? `Abriendo ${appName}.` : `No pude abrir ${appName}.`), action: 'open_app' };
      }
      return { response: `Para abrir aplicaciones necesitas la versión de escritorio de ELYRA.` };
    }
  }

  // ── Open folders ──
  if (/\b(abre|abrir)\b/.test(text) && /\b(carpeta|folder|documentos|descargas|escritorio|imágenes|imagenes|música|musica|videos)\b/.test(text)) {
    const folderMatch = text.match(/(documentos|descargas|escritorio|imágenes|imagenes|música|musica|videos|documents|downloads|desktop|pictures|music)/i);
    if (folderMatch && isDesktop()) {
      const result = await window.elyra!.openFolder(folderMatch[1]);
      return { response: result.message || `Abriendo ${folderMatch[1]}.`, action: 'open_folder' };
    }
    if (folderMatch) return { response: 'Abre carpetas solo está disponible en la app de escritorio.' };
  }

  // ── Search ──
  if (/\b(busca|buscar|búsqueda|busqueda|googlea|search)\b/.test(text)) {
    const match = text.match(/(?:busca|buscar|búsqueda|busqueda|googlea|search)\s+(.+)/);
    if (match) {
      const query = match[1].trim();
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      if (isDesktop()) await window.elyra!.openUrl(url);
      else window.open(url, '_blank');
      return { response: `Buscando "${query}".`, action: 'search' };
    }
  }

  // ── Memory: remember ──
  if (/\b(recuerda|guarda|anota|apunta|memoriza)\b/.test(text)) {
    const match = text.match(/(?:recuerda|guarda|anota|apunta|memoriza)\s+(?:que\s+)?(.+)/);
    if (match && isDesktop()) {
      const note = match[1].trim();
      await window.elyra!.memoryAddNote(note);
      return { response: `Guardado en mi memoria: "${note}".`, action: 'memory' };
    }
    if (match) return { response: `He tomado nota: "${match[1].trim()}".` };
  }

  // ── Memory: recall ──
  if (/\b(qué recuerdas|que recuerdas|mis notas|qué guardaste|que guardaste|memoria)\b/.test(text)) {
    if (isDesktop()) {
      const mem = await window.elyra!.memoryGet();
      if (!mem.notes.length && !mem.facts.length) {
        return { response: 'Aún no tengo notas guardadas. Di "recuerda que..." para guardar algo.' };
      }
      const notes = mem.notes.slice(-5).map((n: any) => `• ${n.text}`).join('\n');
      return { response: `Esto es lo que recuerdo:\n${notes}` };
    }
    return { response: 'La memoria persistente está disponible en la app de escritorio.' };
  }

  // ── System info ──
  if (/\b(estado del sistema|info del sistema|información del sistema|cuánta ram|cuanta ram|uso de cpu|rendimiento)\b/.test(text)) {
    if (isDesktop()) {
      const s = await window.elyra!.getSystemStats();
      return {
        response: `CPU: ${s.cpu}% · RAM: ${s.ram}% (${s.freeMemGB} GB libres de ${s.totalMemGB} GB) · Disco: ${s.disk}% · Equipo: ${s.hostname || 'desconocido'}`,
        action: 'system_stats',
      };
    }
    return { response: 'Consulta de hardware real disponible en la app de escritorio.' };
  }

  // ── Calculator ──
  if (/\b(calcula|cuánto es|cuanto es|resultado de)\b/.test(text)) {
    const match = text.match(/(?:calcula|cuánto es|cuanto es|resultado de)\s+(.+)/);
    if (match) {
      const expr = match[1].replace(/[x×]/g, '*').replace(/[÷]/g, '/').replace(/[^0-9+\-*/().\s]/g, '');
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        return { response: `El resultado es ${result}.` };
      } catch {
        return { response: 'No pude calcular esa expresión.' };
      }
    }
  }

  // ── Jokes / social ──
  if (/\b(chiste|cuéntame algo gracioso|cuentame algo gracioso|hazme reír|hazme reir)\b/.test(text)) {
    return { response: pick(jokes) };
  }
  if (/\b(gracias)\b/.test(text)) {
    return { response: pick(['De nada.', 'Es un placer.', 'Para eso estoy.']) };
  }
  if (/\b(adiós|adios|chao|hasta luego|nos vemos)\b/.test(text)) {
    return { response: 'Hasta pronto. Estaré en segundo plano si me necesitas. Atajo: Ctrl+Shift+E.' };
  }
  if (/\b(cómo estás|como estás|como estas|qué tal estás|que tal estas)\b/.test(text)) {
    return { response: 'Todos mis sistemas operativos. Lista para lo que necesites.' };
  }

  // ── Fallback ──
  return {
    response: `Entendí: "${input}". Puedo abrir apps, carpetas, buscar, calcular, recordar cosas y más. Di "ayuda" para ver capacidades, o habla de forma natural.`,
  };
}
