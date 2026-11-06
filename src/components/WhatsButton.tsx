import { useStore } from '../db';
import { whatsappLink } from '../utils';

/** Abre o WhatsApp com a mensagem pronta e marca como enviada. */
export function WhatsButton({ sentKey, telefone, mensagem, label = 'Enviar' }: { sentKey: string; telefone: string; mensagem: string; label?: string }) {
  const { markSent, isSent } = useStore();
  const sent = isSent(sentKey);
  if (!telefone) return <span className="muted small">sem telefone</span>;
  return (
    <a
      className={`btn whats ${sent ? 'sent' : ''}`}
      href={whatsappLink(telefone, mensagem)}
      target="_blank"
      rel="noreferrer"
      onClick={() => markSent(sentKey)}
      title={mensagem}
    >
      {sent ? '✓ Enviado' : `💬 ${label}`}
    </a>
  );
}
