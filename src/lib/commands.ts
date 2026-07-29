export interface CommandResult {
  response: string;
  action?: string;
  data?: Record<string, unknown>;
}

const greetings = [
  'A su servicio, señor.',
  'Le escucho.',
  'Sistema en línea. ¿En qué puedo ayudarle?',
  'Procesando su solicitud.',
];

const jokes = [
  '¿Por qué los programadores prefieren el frío? Porque no les gusta el calor humano.',
  '¿Cuál es el animal favorito de un programador? El pýthon.',
  'Un byte entra a un bar y el barman le dice: "Lo siento, no servimos a bits sueltos".',
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

export function processCommand(input: string): CommandResult {
  const text = input.toLowerCase().trim();

  if (!text) return { response: 'No detecté ningún comando.' };

  if (/\b(hola|buenas|hey|saludos|qué tal|que tal)\b/.test(text)) {
    return { response: `Hola, señor. ${pick(greetings)}` };
  }

  if (/\b(qué hora|que hora|hora es|dime la hora)\b/.test(text)) {
    return { response: getTime() };
  }

  if (/\b(qué fecha|que fecha|qué día|que dia|día es|fecha de hoy)\b/.test(text)) {
    return { response: getDate() };
  }

  if (/\b(quién eres|quien eres|tu nombre|cómo te llamas|como te llamas|qué eres|que eres)\b/.test(text)) {
    return {
      response:
        'Soy J.A.R.V.I.S., su asistente personal de inteligencia artificial. Estoy diseñado para asistirle con información, comandos de voz y gestión de tareas.',
    };
  }

  if (/\b(qué puedes hacer|que puedes hacer|ayuda|ayúdame|ayudame|funciones|comandos)\b/.test(text)) {
    return {
      response:
        'Puedo hacer lo siguiente: decirle la hora y la fecha, abrir sitios web como YouTube o Google, buscar información en internet, contarle un chiste, y conversar con usted. Simplemente hable o escriba su instrucción.',
    };
  }

  if (/\b(abre|abrir|ve a|navega a|llevame a|llévame a)\b/.test(text)) {
    const match = text.match(/(?:abre|abrir|ve a|navega a|llevame a|llévame a)\s+(.+)/);
    if (match) {
      let site = match[1].trim();
      const knownSites: Record<string, string> = {
        youtube: 'https://www.youtube.com',
        google: 'https://www.google.com',
        gmail: 'https://mail.google.com',
        'google maps': 'https://maps.google.com',
        maps: 'https://maps.google.com',
        twitter: 'https://twitter.com',
        x: 'https://x.com',
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        wikipedia: 'https://es.wikipedia.org',
        github: 'https://github.com',
        spotify: 'https://open.spotify.com',
        netflix: 'https://netflix.com',
        amazon: 'https://amazon.com',
        'el tiempo': 'https://www.google.com/search?q=el+tiempo+hoy',
        noticias: 'https://news.google.com',
      };
      const url = knownSites[site] || (site.includes('.') ? `https://${site}` : `https://www.google.com/search?q=${encodeURIComponent(site)}`);
      window.open(url, '_blank');
      return { response: `Abriendo ${site}.`, action: 'open_url', data: { url } };
    }
  }

  if (/\b(busca|buscar|búsqueda|busqueda|googlea)\b/.test(text)) {
    const match = text.match(/(?:busca|buscar|búsqueda|busqueda|googlea)\s+(.+)/);
    if (match) {
      const query = match[1].trim();
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
      return { response: `Buscando "${query}" en Google.`, action: 'search', data: { query } };
    }
  }

  if (/\b(chiste|cuéntame algo gracioso|cuentame algo gracioso|hazme reír|hazme reir)\b/.test(text)) {
    return { response: pick(jokes) };
  }

  if (/\b(gracias)\b/.test(text)) {
    return { response: pick(['De nada, señor.', 'Es un placer ayudarle.', 'Para eso estoy.']) };
  }

  if (/\b(adiós|adios|chao|hasta luego|nos vemos|ciérrate|cierrate|apágate|apagate|terminar|salir)\b/.test(text)) {
    return { response: 'Hasta pronto, señor. Estaré aquí cuando me necesite.' };
  }

  if (/\b(cómo estás|como estás|como estas|qué tal estás|que tal estas)\b/.test(text)) {
    return { response: 'Todos mis sistemas funcionan al cien por cien. Gracias por preguntar, señor.' };
  }

  if (/\b(calcula|cuánto es|cuanto es|resultado de)\b/.test(text)) {
    const match = text.match(/(?:calcula|cuánto es|cuanto es|resultado de)\s+(.+)/);
    if (match) {
      const expr = match[1].replace(/[x×]/g, '*').replace(/[÷]/g, '/').replace(/[^0-9+\-*/().\s]/g, '');
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        return { response: `El resultado es ${result}.` };
      } catch {
        return { response: 'No pude calcular esa expresión. Inténtelo de otra forma.' };
      }
    }
  }

  return {
    response: `He registrado su mensaje: "${input}". Aún estoy aprendiendo, pero puedo ayudarle con la hora, la fecha, abrir páginas web, buscar en Google, hacer cálculos y contar chistes. Diga "ayuda" para ver todo lo que puedo hacer.`,
  };
}
