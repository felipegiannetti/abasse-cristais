import type { Locale } from './config';

/**
 * Privacy policy (LGPD / GDPR), one document per language. It describes what the system really does: the contact
 * buttons, the anonymous click counter, the single functional cookie, the customer records kept for an order, and
 * the rights of the person. Placeholders, filled by app/[locale]/(site)/privacy/page.tsx:
 *   {controller}  the company name (and CNPJ/address when set)
 *   {contact}     the contact channel (the email from the admin settings, else the WhatsApp number)
 *   {dpo}         the "encarregado" line (named person when NEXT_PUBLIC_LEGAL_DPO_* is set, else the contact channel)
 *
 * Structured after the LGPD (Lei 13.709/2018): what art. 9 requires the person to be told (purpose, form and
 * duration, controller and its contact, sharing and its purpose, the agents' responsibilities, the art. 18 rights),
 * the legal bases of art. 7, international transfer (art. 33), children (art. 14), the encarregado / contact
 * channel (art. 41), request handling (art. 18-19) and incidents (art. 48).
 *
 * It is a text written from how the site works, not legal advice. Keep it in sync if the site starts collecting
 * anything new, and have it reviewed by a lawyer if the business changes (ads, CRM, marketplaces...).
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
  /** the "encarregado" line when a person is named; {name} and {email} */
  dpoNamed: string;
  /** the "encarregado" line when no one is named: the contact channel */
  dpoChannel: string;
  lawLabel: string;
  sections: PrivacySection[];
}

/** ISO date of the last revision of the text below. */
export const PRIVACY_UPDATED = '2026-11-04';

export const LGPD_URL = 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm';

export const privacy: Record<Locale, PrivacyDoc> = {
  pt: {
    title: 'Política de privacidade',
    intro:
      'Esta política explica quais dados pessoais o site da {controller} trata, para quê, por quanto tempo, com quem são compartilhados e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018) e, para visitantes da União Europeia, o GDPR.',
    updatedLabel: 'Última atualização',
    dpoNamed: 'Encarregado pelo tratamento de dados pessoais: {name}{email}.',
    dpoChannel: 'Canal de comunicação com os titulares de dados: {contact}.',
    lawLabel: 'Texto oficial da LGPD (Lei nº 13.709/2018)',
    sections: [
      {
        h: 'Quem é o controlador e como falar com ele',
        p: ['O controlador, isto é, quem decide como os dados tratados neste site são usados, é {controller}. Contato para qualquer assunto de privacidade: {contact}.'],
      },
      {
        h: 'Encarregado e canal de comunicação (art. 41 da LGPD)',
        p: ['{dpo}', 'Esse contato recebe reclamações e comunicações dos titulares, presta esclarecimentos e adota providências.'],
      },
      {
        h: 'Quais dados tratamos',
        ul: [
          'Navegação: o site não exige cadastro nem conta de visitante. Não usamos cookies de publicidade, de análise de audiência nem rastreadores de terceiros.',
          'Contador de cliques: quando você toca em um botão de contato (WhatsApp, SMS ou e-mail) ou escaneia o QR code de uma peça, registramos apenas um código de referência aleatório, qual botão foi usado, a página, a peça, o idioma e a data e hora. Não guardamos seu IP, seu aparelho, seu navegador nem nada que identifique você.',
          'Armazenamento no seu navegador: guardamos somente a sua escolha de idioma (cookie "NEXT_LOCALE", por até 1 ano), para abrir o site no idioma que você escolheu. É um cookie funcional, sem fins de rastreamento. A área administrativa usa um cookie de sessão, que só existe para a equipe da loja.',
          'Contato e pedidos: se você nos chama por WhatsApp, SMS ou e-mail, tratamos o que você nos enviar (nome, telefone, e-mail, mensagens). Para concluir uma compra registramos também o endereço de entrega, a forma de pagamento, o código de rastreio, observações do pedido e, se houver, fotos do que foi enviado.',
          'Lista de novidades por e-mail: se você se cadastrar no formulário do site para ser avisado de peças novas ou promoções, guardamos o seu e-mail e o idioma do site em que você se cadastrou. Usamos isso só para enviar essas notificações, quando o administrador decide enviar uma. Você pode cancelar a qualquer momento, sem custo, pelo link no rodapé de cada e-mail recebido.',
          'Registros técnicos: o provedor de hospedagem do site pode registrar o endereço IP e dados do acesso por motivos de segurança e funcionamento. Só acessamos esses registros no que for necessário para a operação.',
        ],
      },
      {
        h: 'Dados necessários para comprar',
        p: ['Para atender um pedido e entregá-lo, precisamos de dados como seu nome, um contato e o endereço de entrega. Sem eles não conseguimos concluir a compra ou enviar a peça. Você pode exercer os direitos descritos abaixo a qualquer momento, pelo contato informado nesta política.'],
      },
      {
        h: 'Para que usamos e em que base legal (art. 7º)',
        ul: [
          'Atender seu contato e concluir sua compra, incluindo pagamento e envio: execução de contrato e procedimentos preliminares, a pedido do titular (art. 7º, V).',
          'Cumprir obrigações legais e fiscais ligadas às vendas (art. 7º, II).',
          'Medir, de forma agregada e anônima, quais botões e peças despertam interesse, para melhorar o catálogo, e manter o site seguro: legítimo interesse (art. 7º, IX), respeitados seus direitos e liberdades.',
          'Exercer direitos em processos judiciais, administrativos ou arbitrais, quando necessário (art. 7º, VI).',
          'Enviar novidades por e-mail a quem se cadastra para isso: consentimento (art. 7º, I), que você pode revogar a qualquer momento, sem custo, pelo link de cancelamento em cada e-mail ou pelo contato desta política (art. 8º, § 5º).',
        ],
      },
      {
        h: 'Com quem compartilhamos, para quê e quem responde por quê',
        p: ['Compartilhamos dados apenas quando necessário para a operação, e somente o mínimo, cada um para a sua finalidade:'],
        ul: [
          'Transportadoras e Correios, para entregar o pedido (nome, endereço e telefone de contato). Tratam os dados como controladores independentes, para a entrega.',
          'Meios de pagamento que você escolher (por exemplo Pix, PayPal, Wise ou Stripe), para processar o pagamento. Também são controladores independentes, regidos pelas próprias políticas.',
          'Provedores de tecnologia que hospedam o site e o banco de dados. Atuam como operadores: tratam os dados em nosso nome e seguindo nossas instruções.',
          'WhatsApp (Meta), quando você nos chama por lá: a conversa passa a seguir também a política de privacidade deles.',
        ],
        // the controller (us) answers for the purposes and for the operators it hires
      },
      {
        h: 'Transferência para fora do Brasil (art. 33)',
        p: ['Alguns provedores (hospedagem, banco de dados, pagamento) podem tratar dados fora do Brasil. Quando isso ocorre, a transferência segue uma das hipóteses do art. 33 da LGPD, como o uso de cláusulas-padrão contratuais ou a necessidade de executar o contrato do qual você é parte.'],
      },
      {
        h: 'Preços e cotação do dólar',
        p: ['Os preços são definidos em dólares. Na versão em português mostramos a conversão em reais pela cotação do dia (PTAX do Banco Central do Brasil, com cotação de mercado como alternativa). A consulta à cotação é feita pelos nossos servidores; seu navegador não se conecta a nenhum serviço de terceiros por causa disso.'],
      },
      {
        h: 'Por quanto tempo guardamos (arts. 15 e 16)',
        p: ['Os dados do contador de cliques não identificam pessoas. Dados de clientes e pedidos são guardados pelo tempo necessário para o atendimento, a garantia e o cumprimento de obrigações legais e fiscais (em geral, até 5 anos) e para a defesa em eventuais processos; depois são eliminados ou anonimizados. Você pode pedir a eliminação antes, exceto dos dados que a lei nos obrigue a manter (art. 16, I).'],
      },
      {
        h: 'Seus direitos (art. 18 da LGPD)',
        p: ['Você tem direito de obter de nós, a qualquer momento e mediante requisição:'],
        ul: [
          'confirmação da existência de tratamento;',
          'acesso aos dados;',
          'correção de dados incompletos, inexatos ou desatualizados;',
          'anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;',
          'portabilidade dos dados a outro fornecedor de serviço ou produto, mediante requisição expressa e conforme a regulamentação da ANPD;',
          'eliminação dos dados tratados com o seu consentimento, exceto nas hipóteses do art. 16;',
          'informação sobre as entidades públicas e privadas com as quais compartilhamos dados;',
          'informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;',
          'revogação do consentimento.',
        ],
      },
      {
        h: 'Como exercer seus direitos',
        p: [
          'Envie um requerimento expresso para {contact}, dizendo o que deseja; você pode agir por um representante legalmente constituído. O atendimento é gratuito.',
          'Confirmação de que tratamos seus dados e acesso a eles: em formato simplificado, de imediato; ou por declaração clara e completa (origem dos dados, critérios e finalidade do tratamento) em até 15 dias, contados do requerimento (art. 19).',
          'Se não puder atender de imediato, informaremos que não somos o agente de tratamento daqueles dados (indicando quem é, quando possível) ou as razões de fato ou de direito que impedem a providência (art. 18, § 4º). Quando corrigirmos, eliminarmos, anonimizarmos ou bloquearmos dados, avisaremos os agentes com quem os compartilhamos, salvo se for impossível ou exigir esforço desproporcional (art. 18, § 6º).',
          'Você também pode peticionar contra nós à Autoridade Nacional de Proteção de Dados (ANPD) e aos organismos de defesa do consumidor (art. 18, §§ 1º e 8º) e, se estiver na União Europeia, à autoridade de proteção de dados do seu país.',
        ],
      },
      {
        h: 'Crianças e adolescentes (art. 14)',
        p: ['O site não é direcionado a crianças. O tratamento de dados de crianças exige o consentimento específico e em destaque de pelo menos um dos pais ou do responsável legal. Se tomarmos conhecimento de dados de uma criança coletados sem esse consentimento, vamos eliminá-los.'],
      },
      {
        h: 'Segurança e incidentes (arts. 46 e 48)',
        p: [
          'Adotamos medidas técnicas e administrativas para proteger os dados contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração ou divulgação: acesso restrito à área administrativa, com senha e nova confirmação em ações sensíveis; conexão criptografada (HTTPS); registro das alterações feitas no painel; e apagamento de dados pessoais de clientes quando solicitado. Nenhum sistema é totalmente seguro, mas trabalhamos para reduzir os riscos.',
          'Se ocorrer um incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a ANPD e os titulares afetados, em prazo razoável, descrevendo os dados atingidos, os riscos e as medidas adotadas (art. 48).',
        ],
      },
      {
        h: 'Alterações nesta política',
        p: ['Podemos atualizar esta política quando o site mudar ou a lei exigir. A data da última atualização aparece no topo desta página. Se a finalidade de um tratamento mudar de forma incompatível com o que informamos, avisaremos você antes.'],
      },
    ],
  },

  en: {
    title: 'Privacy policy',
    intro:
      'This policy explains which personal data the {controller} website processes, why, for how long, who it is shared with and how you can exercise your rights under Brazil’s General Data Protection Law (LGPD, Law no. 13,709/2018) and, for visitors in the European Union, the GDPR.',
    updatedLabel: 'Last updated',
    dpoNamed: 'Data protection officer (“encarregado”): {name}{email}.',
    dpoChannel: 'Communication channel with data subjects: {contact}.',
    lawLabel: 'Official text of the LGPD (Law no. 13,709/2018, in Portuguese)',
    sections: [
      {
        h: 'Who the controller is and how to reach them',
        p: ['The controller, meaning whoever decides how the data processed on this site is used, is {controller}. Contact for anything about privacy: {contact}.'],
      },
      {
        h: 'Data protection officer and communication channel (LGPD art. 41)',
        p: ['{dpo}', 'This contact receives complaints and communications from data subjects, provides clarifications and takes action.'],
      },
      {
        h: 'What data we process',
        ul: [
          'Browsing: the site needs no sign-up or visitor account. We do not use advertising cookies, audience-analytics cookies or third-party trackers.',
          'Click counter: when you tap a contact button (WhatsApp, SMS or email) or scan a piece’s QR code, we record only a random reference code, which button was used, the page, the piece, the language and the date and time. We do not store your IP address, device, browser or anything that identifies you.',
          'Storage in your browser: we only keep your language choice (cookie “NEXT_LOCALE”, for up to 1 year) so the site opens in the language you picked. It is a functional cookie with no tracking purpose. The administration area uses a session cookie that exists only for the shop’s staff.',
          'Contact and orders: if you reach us by WhatsApp, SMS or email, we process what you send (name, phone, email, messages). To complete a purchase we also record the delivery address, payment method, tracking code, order notes and, if any, photos of what was shipped.',
          'Newsletter: if you sign up on the site to be notified about new pieces or promotions, we keep your email address and the language of the site version you signed up on. We use it only to send those notifications, when the admin decides to send one. You can unsubscribe at any time, free of charge, through the link in the footer of every email you receive.',
          'Technical logs: the site’s hosting provider may log your IP address and access data for security and operation. We only access those logs as far as operating the site requires.',
        ],
      },
      {
        h: 'Data we need in order to sell to you',
        p: ['To handle and deliver an order we need data such as your name, a contact and the delivery address. Without it we cannot complete the purchase or ship the piece. You can exercise the rights described below at any time, through the contact given in this policy.'],
      },
      {
        h: 'Why we use it and on what legal basis (LGPD art. 7; GDPR art. 6)',
        ul: [
          'To answer your contact and complete your purchase, including payment and shipping: performance of a contract and pre-contractual steps at your request (LGPD art. 7, V; GDPR art. 6(1)(b)).',
          'To meet legal and tax obligations tied to sales (LGPD art. 7, II; GDPR art. 6(1)(c)).',
          'To measure, in aggregate and anonymously, which buttons and pieces draw interest, so we can improve the catalogue, and to keep the site secure: legitimate interest (LGPD art. 7, IX; GDPR art. 6(1)(f)), respecting your rights and freedoms.',
          'To exercise rights in judicial, administrative or arbitration proceedings when needed (LGPD art. 7, VI).',
          'To send newsletter emails to those who sign up for them: consent (LGPD art. 7, I; GDPR art. 6(1)(a)), which you may withdraw at any time, free of charge, through the unsubscribe link in each email or the contact in this policy (LGPD art. 8, § 5).',
        ],
      },
      {
        h: 'Who we share it with, why, and who is responsible for what',
        p: ['We share data only when needed to run the business, and only the minimum, each for its own purpose:'],
        ul: [
          'Carriers and postal services, to deliver the order (name, address and contact phone). They process the data as independent controllers, for the delivery.',
          'The payment methods you choose (for example Pix, PayPal, Wise or Stripe), to process the payment. They are also independent controllers, governed by their own policies.',
          'Technology providers that host the site and the database. They act as processors: they process data on our behalf and under our instructions.',
          'WhatsApp (Meta), when you contact us there: the conversation is then also covered by their privacy policy.',
        ],
      },
      {
        h: 'Transfers outside Brazil (LGPD art. 33)',
        p: ['Some providers (hosting, database, payment) may process data outside Brazil. When that happens, the transfer follows one of the cases of art. 33 of the LGPD, such as standard contractual clauses or the need to perform the contract you are party to. For visitors in the European Union, the GDPR transfer rules also apply.'],
      },
      {
        h: 'Prices and the dollar exchange rate',
        p: ['Prices are set in US dollars. On the Portuguese version we show the conversion to reais at the day’s rate (the Brazilian Central Bank’s PTAX, with a market rate as a fallback). The rate lookup is made by our servers; your browser does not connect to any third-party service because of it.'],
      },
      {
        h: 'How long we keep it (LGPD arts. 15 and 16)',
        p: ['Click-counter data does not identify anyone. Customer and order data is kept for as long as needed for service, warranty, legal and tax obligations (generally up to 5 years) and to defend ourselves in possible proceedings, then deleted or anonymised. You can ask for deletion sooner, except for data the law requires us to keep (LGPD art. 16, I).'],
      },
      {
        h: 'Your rights (LGPD art. 18)',
        p: ['You have the right to obtain from us, at any time and on request:'],
        ul: [
          'confirmation that we process your data;',
          'access to the data;',
          'correction of incomplete, inaccurate or outdated data;',
          'anonymisation, blocking or deletion of unnecessary or excessive data, or data processed in breach of the law;',
          'portability of the data to another service or product provider, on express request and according to the ANPD’s regulations;',
          'deletion of data processed on the basis of your consent, except in the cases of art. 16;',
          'information about the public and private entities we have shared data with;',
          'information about the possibility of not giving consent and the consequences of refusing;',
          'withdrawal of consent.',
          'Visitors in the European Union also have the GDPR rights of access, rectification, erasure, restriction, portability and objection.',
        ],
      },
      {
        h: 'How to exercise your rights',
        p: [
          'Send an express request to {contact} saying what you want; you may act through a legally appointed representative. It is free of charge.',
          'Confirmation that we process your data and access to it: in a simplified format, immediately; or by a clear and complete statement (origin of the data, criteria and purpose of the processing) within 15 days of the request (LGPD art. 19).',
          'If we cannot act immediately, we will tell you that we are not the processing agent for that data (pointing to who is, where possible) or the factual or legal reasons that prevent it (art. 18, § 4). When we correct, delete, anonymise or block data, we will inform the parties we shared it with, unless that is impossible or takes disproportionate effort (art. 18, § 6).',
          'You may also lodge a complaint against us with Brazil’s data protection authority (ANPD) and with consumer protection bodies (art. 18, §§ 1 and 8) and, if you are in the European Union, with your country’s data protection authority.',
        ],
      },
      {
        h: 'Children and teenagers (LGPD art. 14)',
        p: ['The site is not aimed at children. Processing a child’s data requires the specific and prominent consent of at least one parent or legal guardian. If we learn of a child’s data collected without that consent, we will delete it.'],
      },
      {
        h: 'Security and incidents (LGPD arts. 46 and 48)',
        p: [
          'We use technical and administrative measures to protect data against unauthorised access and accidental or unlawful destruction, loss, alteration or disclosure: restricted access to the administration area with a password and re-confirmation for sensitive actions; encrypted connections (HTTPS); a log of changes made in the panel; and deletion of customers’ personal data on request. No system is completely secure, but we work to reduce risk.',
          'If a security incident occurs that may cause relevant risk or harm to data subjects, we will notify the ANPD and the affected people within a reasonable time, describing the data involved, the risks and the measures taken (art. 48).',
        ],
      },
      {
        h: 'Changes to this policy',
        p: ['We may update this policy when the site changes or the law requires. The date of the last update is shown at the top of this page. If the purpose of a processing changes in a way that is incompatible with what we told you, we will tell you beforehand.'],
      },
    ],
  },

  es: {
    title: 'Política de privacidad',
    intro:
      'Esta política explica qué datos personales trata el sitio de {controller}, para qué, por cuánto tiempo, con quién se comparten y cómo puedes ejercer tus derechos según la Ley General de Protección de Datos de Brasil (LGPD, Ley n.º 13.709/2018) y, para visitantes de la Unión Europea, el RGPD.',
    updatedLabel: 'Última actualización',
    dpoNamed: 'Encargado del tratamiento de datos personales («encarregado»): {name}{email}.',
    dpoChannel: 'Canal de comunicación con los titulares de datos: {contact}.',
    lawLabel: 'Texto oficial de la LGPD (Ley n.º 13.709/2018, en portugués)',
    sections: [
      {
        h: 'Quién es el responsable y cómo contactarlo',
        p: ['El responsable, es decir, quien decide cómo se usan los datos tratados en este sitio, es {controller}. Contacto para cualquier asunto de privacidad: {contact}.'],
      },
      {
        h: 'Encargado y canal de comunicación (art. 41 de la LGPD)',
        p: ['{dpo}', 'Este contacto recibe reclamaciones y comunicaciones de los titulares, ofrece aclaraciones y adopta medidas.'],
      },
      {
        h: 'Qué datos tratamos',
        ul: [
          'Navegación: el sitio no requiere registro ni cuenta de visitante. No usamos cookies de publicidad, de análisis de audiencia ni rastreadores de terceros.',
          'Contador de clics: cuando pulsas un botón de contacto (WhatsApp, SMS o correo) o escaneas el código QR de una pieza, registramos solo un código de referencia aleatorio, qué botón se usó, la página, la pieza, el idioma y la fecha y hora. No guardamos tu IP, tu dispositivo, tu navegador ni nada que te identifique.',
          'Almacenamiento en tu navegador: solo guardamos tu elección de idioma (cookie «NEXT_LOCALE», hasta 1 año) para abrir el sitio en el idioma que elegiste. Es una cookie funcional, sin fines de rastreo. El área administrativa usa una cookie de sesión que solo existe para el equipo de la tienda.',
          'Contacto y pedidos: si nos escribes por WhatsApp, SMS o correo, tratamos lo que nos envíes (nombre, teléfono, correo, mensajes). Para completar una compra registramos también la dirección de entrega, la forma de pago, el código de seguimiento, notas del pedido y, si las hay, fotos de lo enviado.',
          'Novedades por correo: si te registras en el sitio para que te avisemos de piezas nuevas o promociones, guardamos tu correo electrónico y el idioma del sitio en el que te registraste. Lo usamos solo para enviar esos avisos, cuando el administrador decide enviar uno. Puedes cancelar en cualquier momento, sin costo, mediante el enlace en el pie de cada correo recibido.',
          'Registros técnicos: el proveedor de alojamiento del sitio puede registrar la dirección IP y datos del acceso por seguridad y funcionamiento. Solo accedemos a esos registros en lo necesario para operar.',
        ],
      },
      {
        h: 'Datos necesarios para comprar',
        p: ['Para atender y entregar un pedido necesitamos datos como tu nombre, un contacto y la dirección de entrega. Sin ellos no podemos completar la compra ni enviar la pieza. Puedes ejercer los derechos descritos más abajo en cualquier momento, mediante el contacto indicado en esta política.'],
      },
      {
        h: 'Para qué los usamos y con qué base legal (art. 7 de la LGPD; art. 6 del RGPD)',
        ul: [
          'Atender tu contacto y completar tu compra, incluidos el pago y el envío: ejecución de un contrato y medidas precontractuales a petición del titular (LGPD art. 7, V; RGPD art. 6.1.b).',
          'Cumplir obligaciones legales y fiscales ligadas a las ventas (LGPD art. 7, II; RGPD art. 6.1.c).',
          'Medir, de forma agregada y anónima, qué botones y piezas despiertan interés, para mejorar el catálogo, y mantener el sitio seguro: interés legítimo (LGPD art. 7, IX; RGPD art. 6.1.f), respetando tus derechos y libertades.',
          'Ejercer derechos en procesos judiciales, administrativos o arbitrales, cuando sea necesario (LGPD art. 7, VI).',
          'Enviar novedades por correo a quienes se registran para ello: consentimiento (LGPD art. 7, I; RGPD art. 6.1.a), que puedes revocar en cualquier momento, sin coste, mediante el enlace de cancelación en cada correo o el contacto de esta política (LGPD art. 8, § 5).',
        ],
      },
      {
        h: 'Con quién los compartimos, para qué y quién responde de qué',
        p: ['Compartimos datos solo cuando es necesario para la operación, y solo lo mínimo, cada uno para su finalidad:'],
        ul: [
          'Transportistas y correos, para entregar el pedido (nombre, dirección y teléfono de contacto). Tratan los datos como responsables independientes, para la entrega.',
          'Los medios de pago que elijas (por ejemplo Pix, PayPal, Wise o Stripe), para procesar el pago. También son responsables independientes, regidos por sus propias políticas.',
          'Proveedores de tecnología que alojan el sitio y la base de datos. Actúan como encargados: tratan los datos en nuestro nombre y siguiendo nuestras instrucciones.',
          'WhatsApp (Meta), cuando nos escribes por allí: la conversación pasa a regirse también por su política de privacidad.',
        ],
      },
      {
        h: 'Transferencias fuera de Brasil (art. 33 de la LGPD)',
        p: ['Algunos proveedores (alojamiento, base de datos, pago) pueden tratar datos fuera de Brasil. Cuando ocurre, la transferencia sigue uno de los supuestos del art. 33 de la LGPD, como las cláusulas contractuales tipo o la necesidad de ejecutar el contrato del que eres parte. Para visitantes de la Unión Europea se aplican también las reglas de transferencia del RGPD.'],
      },
      {
        h: 'Precios y cotización del dólar',
        p: ['Los precios se fijan en dólares estadounidenses. En la versión en portugués mostramos la conversión a reales con la cotización del día (PTAX del Banco Central de Brasil, con una cotización de mercado como alternativa). La consulta de la cotización la hacen nuestros servidores; tu navegador no se conecta a ningún servicio de terceros por ello.'],
      },
      {
        h: 'Cuánto tiempo los conservamos (arts. 15 y 16 de la LGPD)',
        p: ['Los datos del contador de clics no identifican a nadie. Los datos de clientes y pedidos se conservan el tiempo necesario para la atención, la garantía y las obligaciones legales y fiscales (en general, hasta 5 años) y para defendernos en posibles procesos; luego se eliminan o anonimizan. Puedes pedir la eliminación antes, salvo los datos que la ley nos obligue a conservar (LGPD art. 16, I).'],
      },
      {
        h: 'Tus derechos (art. 18 de la LGPD)',
        p: ['Tienes derecho a obtener de nosotros, en cualquier momento y mediante solicitud:'],
        ul: [
          'confirmación de la existencia de tratamiento;',
          'acceso a los datos;',
          'corrección de datos incompletos, inexactos o desactualizados;',
          'anonimización, bloqueo o eliminación de datos innecesarios, excesivos o tratados en contra de la ley;',
          'portabilidad de los datos a otro proveedor de servicio o producto, mediante solicitud expresa y según la regulación de la ANPD;',
          'eliminación de los datos tratados con tu consentimiento, salvo en los supuestos del art. 16;',
          'información sobre las entidades públicas y privadas con las que compartimos datos;',
          'información sobre la posibilidad de no dar el consentimiento y sus consecuencias;',
          'revocación del consentimiento.',
          'Los visitantes de la Unión Europea tienen además los derechos del RGPD de acceso, rectificación, supresión, limitación, portabilidad y oposición.',
        ],
      },
      {
        h: 'Cómo ejercer tus derechos',
        p: [
          'Envía una solicitud expresa a {contact} indicando lo que deseas; puedes actuar mediante un representante legalmente constituido. La atención es gratuita.',
          'Confirmación de que tratamos tus datos y acceso a ellos: en formato simplificado, de inmediato; o mediante una declaración clara y completa (origen de los datos, criterios y finalidad del tratamiento) en un plazo de hasta 15 días desde la solicitud (LGPD art. 19).',
          'Si no podemos atenderte de inmediato, te informaremos de que no somos el agente de tratamiento de esos datos (indicando quién lo es, cuando sea posible) o de las razones de hecho o de derecho que lo impiden (art. 18, § 4). Cuando corrijamos, eliminemos, anonimicemos o bloqueemos datos, avisaremos a los agentes con los que los compartimos, salvo que sea imposible o exija un esfuerzo desproporcionado (art. 18, § 6).',
          'También puedes reclamar contra nosotros ante la Autoridad Nacional de Protección de Datos de Brasil (ANPD) y ante los organismos de defensa del consumidor (art. 18, §§ 1 y 8) y, si estás en la Unión Europea, ante la autoridad de protección de datos de tu país.',
        ],
      },
      {
        h: 'Niños y adolescentes (art. 14 de la LGPD)',
        p: ['El sitio no está dirigido a niños. El tratamiento de datos de niños exige el consentimiento específico y destacado de al menos uno de los padres o del representante legal. Si tenemos conocimiento de datos de un niño recogidos sin ese consentimiento, los eliminaremos.'],
      },
      {
        h: 'Seguridad e incidentes (arts. 46 y 48 de la LGPD)',
        p: [
          'Adoptamos medidas técnicas y administrativas para proteger los datos frente a accesos no autorizados y situaciones accidentales o ilícitas de destrucción, pérdida, alteración o divulgación: acceso restringido al área administrativa, con contraseña y nueva confirmación en acciones sensibles; conexión cifrada (HTTPS); registro de los cambios hechos en el panel; y eliminación de datos personales de clientes cuando se solicita. Ningún sistema es totalmente seguro, pero trabajamos para reducir los riesgos.',
          'Si ocurre un incidente de seguridad que pueda acarrear un riesgo o daño relevante para los titulares, lo comunicaremos a la ANPD y a las personas afectadas en un plazo razonable, describiendo los datos afectados, los riesgos y las medidas adoptadas (art. 48).',
        ],
      },
      {
        h: 'Cambios en esta política',
        p: ['Podemos actualizar esta política cuando el sitio cambie o la ley lo exija. La fecha de la última actualización aparece al inicio de esta página. Si la finalidad de un tratamiento cambia de forma incompatible con lo que te informamos, te avisaremos antes.'],
      },
    ],
  },
};
