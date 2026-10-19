import type { Locale } from './config';

/**
 * Privacy policy (LGPD / GDPR), one document per language. It describes what the system really does:
 * the contact buttons, the anonymous click counter, the two functional cookies, the customer records kept for an
 * order, and the rights of the person. `{controller}` is replaced with the company name (and CNPJ when set) and
 * `{contact}` with the contact channel, see app/[locale]/(site)/privacy/page.tsx.
 *
 * It is a general-purpose text written from how the site works, not legal advice: have the company's lawyer
 * review it before publishing, and keep it in sync if the site starts collecting anything new.
 */
export interface PrivacySection {
  h: string;
  p?: string[];
  ul?: string[];
}
export interface PrivacyDoc {
  title: string;
  intro: string;
  updatedLabel: string;
  sections: PrivacySection[];
}

/** ISO date of the last revision of the text below. */
export const PRIVACY_UPDATED = '2026-10-19';

export const privacy: Record<Locale, PrivacyDoc> = {
  pt: {
    title: 'Política de privacidade',
    intro:
      'Esta política explica quais dados pessoais o site da {controller} trata, para quê, com quem são compartilhados e como você pode exercer seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) e, para visitantes da União Europeia, o GDPR.',
    updatedLabel: 'Última atualização',
    sections: [
      {
        h: 'Quem é o responsável',
        p: ['O controlador dos dados tratados neste site é {controller}. Para qualquer assunto sobre privacidade, fale conosco: {contact}.'],
      },
      {
        h: 'Quais dados tratamos',
        ul: [
          'Navegação: o site não exige cadastro nem conta de visitante. Não usamos cookies de publicidade, de análise de audiência nem rastreadores de terceiros.',
          'Contador de cliques: quando você toca em um botão de contato (WhatsApp, SMS ou e-mail) ou escaneia um QR code de uma peça, registramos apenas um código de referência aleatório, qual botão foi usado, a página, a peça, o idioma e a data e hora. Não guardamos seu IP, seu aparelho, seu navegador nem nada que identifique você.',
          'Armazenamento no seu navegador: guardamos somente a sua escolha de idioma (cookie "NEXT_LOCALE", por até 1 ano), para abrir o site no idioma que você escolheu. É um cookie funcional, sem fins de rastreamento. A área administrativa usa um cookie de sessão, que só existe para a equipe da loja.',
          'Contato e pedidos: se você nos chama por WhatsApp, SMS ou e-mail, tratamos o que você nos enviar (nome, telefone, e-mail, mensagens). Para concluir uma compra podemos registrar também endereço de entrega, forma de pagamento, código de rastreio, observações do pedido e fotos do que foi enviado.',
          'Registros técnicos: o provedor de hospedagem do site pode registrar o endereço IP e dados do acesso por motivos de segurança e funcionamento. Não temos acesso a esses registros além do necessário para a operação.',
        ],
      },
      {
        h: 'Para que usamos e com que base legal',
        ul: [
          'Atender seu contato e concluir sua compra, incluindo pagamento e envio (execução de contrato e procedimentos preliminares, LGPD art. 7º, V).',
          'Cumprir obrigações legais e fiscais ligadas às vendas (art. 7º, II).',
          'Medir, de forma agregada e anônima, quais botões e peças despertam interesse, para melhorar o catálogo (legítimo interesse, art. 7º, IX).',
          'Manter o site seguro e prevenir abusos (legítimo interesse).',
        ],
      },
      {
        h: 'Com quem compartilhamos',
        p: ['Compartilhamos dados apenas quando necessário para a operação, e somente o mínimo:'],
        ul: [
          'Transportadoras e Correios, para entregar o pedido (nome, endereço e telefone de contato).',
          'Meios de pagamento que você escolher (por exemplo Pix, PayPal, Wise ou Stripe).',
          'Provedores de tecnologia que hospedam o site e o banco de dados, que podem estar fora do Brasil; nesses casos exigimos padrões de proteção compatíveis com a lei.',
          'WhatsApp (Meta), quando você nos chama por lá: a conversa passa a seguir também a política de privacidade deles.',
        ],
      },
      {
        h: 'Preços e cotação do dólar',
        p: ['Os preços são definidos em dólares. Na versão em português mostramos a conversão em reais pela cotação do dia (PTAX do Banco Central do Brasil, com cotação de mercado como alternativa). A consulta à cotação é feita pelos nossos servidores; seu navegador não se conecta a nenhum serviço de terceiros por causa disso.'],
      },
      {
        h: 'Por quanto tempo guardamos',
        p: ['Os dados de contador de cliques não identificam pessoas. Dados de clientes e pedidos são guardados pelo tempo necessário para o atendimento, a garantia e as obrigações legais e fiscais (em geral, até 5 anos), e depois eliminados ou anonimizados. Você pode pedir a eliminação antes disso, salvo o que a lei nos obrigue a manter.'],
      },
      {
        h: 'Seus direitos',
        p: ['Você pode, a qualquer momento e sem custo, pedir:'],
        ul: [
          'confirmação de que tratamos seus dados e acesso a eles;',
          'correção de dados incompletos, inexatos ou desatualizados;',
          'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;',
          'portabilidade dos dados;',
          'informação sobre com quem compartilhamos;',
          'revogação de consentimento e oposição a um tratamento, quando aplicável.',
        ],
      },
      {
        h: 'Como exercer seus direitos',
        p: ['Escreva para {contact} informando o que deseja. Podemos pedir uma confirmação de identidade e responderemos no prazo legal. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) e, se estiver na União Europeia, à autoridade de proteção de dados do seu país.'],
      },
      {
        h: 'Segurança',
        p: ['Adotamos medidas técnicas e organizacionais para proteger os dados: acesso restrito à área administrativa com senha e confirmação em ações sensíveis, conexão criptografada (HTTPS), registro das alterações feitas no painel e apagamento de dados pessoais de clientes quando solicitado. Nenhum sistema é 100% seguro, mas trabalhamos para reduzir riscos.'],
      },
      {
        h: 'Alterações nesta política',
        p: ['Podemos atualizar esta política quando o site mudar ou a lei exigir. A data da última atualização aparece no topo desta página.'],
      },
    ],
  },

  en: {
    title: 'Privacy policy',
    intro:
      'This policy explains which personal data the {controller} website processes, why, who it is shared with and how you can exercise your rights under Brazil’s General Data Protection Law (LGPD, Law 13,709/2018) and, for visitors in the European Union, the GDPR.',
    updatedLabel: 'Last updated',
    sections: [
      {
        h: 'Who is responsible',
        p: ['The controller of the data processed on this site is {controller}. For anything about privacy, contact us: {contact}.'],
      },
      {
        h: 'What data we process',
        ul: [
          'Browsing: the site needs no sign-up or visitor account. We do not use advertising cookies, audience-analytics cookies or third-party trackers.',
          'Click counter: when you tap a contact button (WhatsApp, SMS or email) or scan a piece’s QR code, we record only a random reference code, which button was used, the page, the piece, the language and the date and time. We do not store your IP address, device, browser or anything that identifies you.',
          'Storage in your browser: we only keep your language choice (cookie “NEXT_LOCALE”, for up to 1 year) so the site opens in the language you picked. It is a functional cookie with no tracking purpose. The administration area uses a session cookie that exists only for the shop’s staff.',
          'Contact and orders: if you reach us by WhatsApp, SMS or email, we process what you send (name, phone, email, messages). To complete a purchase we may also record a delivery address, payment method, tracking code, order notes and photos of what was shipped.',
          'Technical logs: the site’s hosting provider may log your IP address and access data for security and operation. We have no access to those logs beyond what operating the site requires.',
        ],
      },
      {
        h: 'Why we use it and on what legal basis',
        ul: [
          'To answer your contact and complete your purchase, including payment and shipping (performance of a contract and pre-contractual steps; LGPD art. 7, V; GDPR art. 6(1)(b)).',
          'To meet legal and tax obligations tied to sales (LGPD art. 7, II; GDPR art. 6(1)(c)).',
          'To measure, in aggregate and anonymously, which buttons and pieces draw interest, so we can improve the catalogue (legitimate interest; LGPD art. 7, IX; GDPR art. 6(1)(f)).',
          'To keep the site secure and prevent abuse (legitimate interest).',
        ],
      },
      {
        h: 'Who we share it with',
        p: ['We share data only when needed to run the business, and only the minimum:'],
        ul: [
          'Carriers and postal services, to deliver the order (name, address and contact phone).',
          'The payment methods you choose (for example Pix, PayPal, Wise or Stripe).',
          'Technology providers that host the site and the database, which may be outside Brazil; in that case we require protection standards consistent with the law.',
          'WhatsApp (Meta), when you contact us there: the conversation is then also covered by their privacy policy.',
        ],
      },
      {
        h: 'Prices and the dollar exchange rate',
        p: ['Prices are set in US dollars. On the Portuguese version we show the conversion to reais at the day’s rate (the Brazilian Central Bank’s PTAX, with a market rate as a fallback). The rate lookup is made by our servers; your browser does not connect to any third-party service because of it.'],
      },
      {
        h: 'How long we keep it',
        p: ['Click-counter data does not identify anyone. Customer and order data is kept for as long as needed for service, warranty and legal and tax obligations (generally up to 5 years), then deleted or anonymised. You can ask for deletion sooner, except for what the law requires us to keep.'],
      },
      {
        h: 'Your rights',
        p: ['At any time, free of charge, you may ask for:'],
        ul: [
          'confirmation that we process your data, and access to it;',
          'correction of incomplete, inaccurate or outdated data;',
          'anonymisation, blocking or deletion of unnecessary data or data processed unlawfully;',
          'data portability;',
          'information about who we share it with;',
          'withdrawal of consent and objection to processing, where applicable.',
        ],
      },
      {
        h: 'How to exercise your rights',
        p: ['Write to {contact} saying what you want. We may ask you to confirm your identity and will answer within the legal deadline. You may also complain to Brazil’s data protection authority (ANPD) and, if you are in the European Union, to your country’s data protection authority.'],
      },
      {
        h: 'Security',
        p: ['We use technical and organisational measures to protect data: restricted access to the administration area with a password and re-confirmation for sensitive actions, encrypted connections (HTTPS), a log of changes made in the panel, and deletion of customers’ personal data on request. No system is 100% secure, but we work to reduce risk.'],
      },
      {
        h: 'Changes to this policy',
        p: ['We may update this policy when the site changes or the law requires. The date of the last update is shown at the top of this page.'],
      },
    ],
  },

  es: {
    title: 'Política de privacidad',
    intro:
      'Esta política explica qué datos personales trata el sitio de {controller}, para qué, con quién se comparten y cómo puedes ejercer tus derechos según la Ley General de Protección de Datos de Brasil (LGPD, Ley 13.709/2018) y, para visitantes de la Unión Europea, el RGPD.',
    updatedLabel: 'Última actualización',
    sections: [
      {
        h: 'Quién es el responsable',
        p: ['El responsable de los datos tratados en este sitio es {controller}. Para cualquier asunto de privacidad, escríbenos: {contact}.'],
      },
      {
        h: 'Qué datos tratamos',
        ul: [
          'Navegación: el sitio no requiere registro ni cuenta de visitante. No usamos cookies de publicidad, de análisis de audiencia ni rastreadores de terceros.',
          'Contador de clics: cuando pulsas un botón de contacto (WhatsApp, SMS o correo) o escaneas el código QR de una pieza, registramos solo un código de referencia aleatorio, qué botón se usó, la página, la pieza, el idioma y la fecha y hora. No guardamos tu IP, tu dispositivo, tu navegador ni nada que te identifique.',
          'Almacenamiento en tu navegador: solo guardamos tu elección de idioma (cookie «NEXT_LOCALE», hasta 1 año) para abrir el sitio en el idioma que elegiste. Es una cookie funcional, sin fines de rastreo. El área administrativa usa una cookie de sesión que solo existe para el equipo de la tienda.',
          'Contacto y pedidos: si nos escribes por WhatsApp, SMS o correo, tratamos lo que nos envíes (nombre, teléfono, correo, mensajes). Para completar una compra podemos registrar también dirección de entrega, forma de pago, código de seguimiento, notas del pedido y fotos de lo enviado.',
          'Registros técnicos: el proveedor de alojamiento del sitio puede registrar la dirección IP y datos del acceso por seguridad y funcionamiento. No tenemos acceso a esos registros más allá de lo necesario para operar.',
        ],
      },
      {
        h: 'Para qué los usamos y con qué base legal',
        ul: [
          'Atender tu contacto y completar tu compra, incluidos el pago y el envío (ejecución de un contrato y medidas precontractuales; LGPD art. 7, V; RGPD art. 6.1.b).',
          'Cumplir obligaciones legales y fiscales ligadas a las ventas (LGPD art. 7, II; RGPD art. 6.1.c).',
          'Medir, de forma agregada y anónima, qué botones y piezas despiertan interés, para mejorar el catálogo (interés legítimo; LGPD art. 7, IX; RGPD art. 6.1.f).',
          'Mantener el sitio seguro y prevenir abusos (interés legítimo).',
        ],
      },
      {
        h: 'Con quién los compartimos',
        p: ['Compartimos datos solo cuando es necesario para la operación, y solo lo mínimo:'],
        ul: [
          'Transportistas y correos, para entregar el pedido (nombre, dirección y teléfono de contacto).',
          'Los medios de pago que elijas (por ejemplo Pix, PayPal, Wise o Stripe).',
          'Proveedores de tecnología que alojan el sitio y la base de datos, que pueden estar fuera de Brasil; en ese caso exigimos estándares de protección compatibles con la ley.',
          'WhatsApp (Meta), cuando nos escribes por allí: la conversación pasa a regirse también por su política de privacidad.',
        ],
      },
      {
        h: 'Precios y cotización del dólar',
        p: ['Los precios se fijan en dólares estadounidenses. En la versión en portugués mostramos la conversión a reales con la cotización del día (PTAX del Banco Central de Brasil, con una cotización de mercado como alternativa). La consulta de la cotización la hacen nuestros servidores; tu navegador no se conecta a ningún servicio de terceros por ello.'],
      },
      {
        h: 'Cuánto tiempo los conservamos',
        p: ['Los datos del contador de clics no identifican a nadie. Los datos de clientes y pedidos se conservan el tiempo necesario para la atención, la garantía y las obligaciones legales y fiscales (en general, hasta 5 años), y luego se eliminan o anonimizan. Puedes pedir la eliminación antes, salvo lo que la ley nos obligue a conservar.'],
      },
      {
        h: 'Tus derechos',
        p: ['En cualquier momento y sin coste, puedes solicitar:'],
        ul: [
          'confirmación de que tratamos tus datos y acceso a ellos;',
          'corrección de datos incompletos, inexactos o desactualizados;',
          'anonimización, bloqueo o eliminación de datos innecesarios o tratados contra la ley;',
          'portabilidad de los datos;',
          'información sobre con quién los compartimos;',
          'revocación del consentimiento y oposición a un tratamiento, cuando corresponda.',
        ],
      },
      {
        h: 'Cómo ejercer tus derechos',
        p: ['Escribe a {contact} indicando lo que deseas. Podemos pedirte confirmar tu identidad y responderemos en el plazo legal. También puedes reclamar ante la Autoridad Nacional de Protección de Datos de Brasil (ANPD) y, si estás en la Unión Europea, ante la autoridad de protección de datos de tu país.'],
      },
      {
        h: 'Seguridad',
        p: ['Adoptamos medidas técnicas y organizativas para proteger los datos: acceso restringido al área administrativa con contraseña y reconfirmación en acciones sensibles, conexión cifrada (HTTPS), registro de los cambios hechos en el panel y eliminación de datos personales de clientes cuando se solicita. Ningún sistema es 100 % seguro, pero trabajamos para reducir riesgos.'],
      },
      {
        h: 'Cambios en esta política',
        p: ['Podemos actualizar esta política cuando el sitio cambie o la ley lo exija. La fecha de la última actualización aparece al inicio de esta página.'],
      },
    ],
  },
};
