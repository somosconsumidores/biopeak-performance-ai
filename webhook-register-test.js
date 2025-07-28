const registerWebhook = async () => {
  const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/register-polar-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accessToken: 'aaa6f4948905ad1ad6c4847604ef368b',
      action: 'register'
    })
  });

  const result = await response.json();
  console.log('Resultado do registro:', result);
};

// Também vamos listar os webhooks existentes primeiro
const listWebhooks = async () => {
  const response = await fetch('https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/register-polar-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accessToken: 'aaa6f4948905ad1ad6c4847604ef368b',
      action: 'list'
    })
  });

  const result = await response.json();
  console.log('Webhooks existentes:', result);
};

// Executar as funções
listWebhooks().then(() => registerWebhook());