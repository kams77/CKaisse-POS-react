import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface ApiPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  feeAmount: number;
  netAmount: number;
  description: string;
  channel: 'web_checkout' | 'pos_terminal' | 'payment_link' | 'invoice';
  customerName: string;
  customerContact: string;
  status: 'requires_payment_method' | 'succeeded' | 'failed';
  paymentMethod?: 'mobile_money' | 'card';
  operator?: string;
  reference?: string;
  createdAt: string;
}

const paymentIntentsStore: ApiPaymentIntent[] = [];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Production Container Health Check
  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'CKaisse-POS-KolaPay',
    });
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'CKaisse-POS-KolaPay',
    });
  });

  // 1. Health & Gateway Configuration Endpoint
  app.get('/api/v1/status', (_req, res) => {
    res.json({
      gateway: 'KolaPay FinTech API',
      version: '2026-10-01',
      status: 'operational',
      commissionRatePercent: 2.0,
      supportedCurrencies: ['USD', 'CDF', 'XOF', 'EUR'],
      supportedRails: [
        'M-Pesa',
        'Orange Money',
        'Airtel Money',
        'Wave',
        'MTN MoMo',
        'Visa / Mastercard',
      ],
    });
  });

  // 2. Create a Payment Intent (Web / POS / Link)
  app.post('/api/v1/payment-intents', (req, res) => {
    const {
      amount = 25.0,
      currency = 'USD',
      description = 'Commande en ligne',
      channel = 'web_checkout',
      customerName = 'Client Web',
      customerContact = '+243 81 000 0000',
    } = req.body || {};

    const numericAmount = Math.max(0.5, Number(amount) || 25.0);
    const feeAmount = Number((numericAmount * 0.02).toFixed(2));
    const netAmount = Number((numericAmount - feeAmount).toFixed(2));
    const id = `pi_kola_${crypto.randomBytes(5).toString('hex')}`;

    const intent: ApiPaymentIntent = {
      id,
      amount: numericAmount,
      currency,
      feeAmount,
      netAmount,
      description,
      channel,
      customerName,
      customerContact,
      status: 'requires_payment_method',
      createdAt: new Date().toISOString(),
    };

    paymentIntentsStore.unshift(intent);

    res.status(201).json({
      object: 'payment_intent',
      ...intent,
      client_secret: `${id}_secret_${crypto.randomBytes(8).toString('hex')}`,
      checkout_url: `https://pay.kolapay.io/checkout/${id}`,
    });
  });

  // 3. Confirm / Settle a Payment Intent & Generate Signed Webhook
  app.post('/api/v1/payment-intents/:id/confirm', (req, res) => {
    const { id } = req.params;
    const {
      paymentMethod = 'mobile_money',
      operator = 'M-Pesa',
      webhookSecret = 'whsec_kola_live_99481a2b3c4d',
    } = req.body || {};

    let intent = paymentIntentsStore.find((item) => item.id === id);
    if (!intent) {
      intent = {
        id,
        amount: Number(req.body?.amount) || 50,
        currency: req.body?.currency || 'USD',
        feeAmount: Number(((Number(req.body?.amount) || 50) * 0.02).toFixed(2)),
        netAmount: Number(((Number(req.body?.amount) || 50) * 0.98).toFixed(2)),
        description: req.body?.description || 'Paiement API Direct',
        channel: req.body?.channel || 'web_checkout',
        customerName: req.body?.customerName || 'Client API',
        customerContact: req.body?.customerContact || '+243 99 000 0000',
        status: 'succeeded',
        paymentMethod,
        operator,
        reference: `REF-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
      };
      paymentIntentsStore.unshift(intent);
    } else {
      intent.status = 'succeeded';
      intent.paymentMethod = paymentMethod;
      intent.operator = operator;
      intent.reference = `REF-${Date.now().toString().slice(-6)}`;
    }

    const webhookPayload = {
      id: `evt_kola_${crypto.randomBytes(5).toString('hex')}`,
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: intent,
      },
    };

    const payloadString = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    res.json({
      status: 'succeeded',
      payment_intent: intent,
      webhook_delivery: {
        header_signature: `t=${webhookPayload.created},v1=${signature}`,
        http_status: 200,
        payload: webhookPayload,
      },
    });
  });

  // 4. List Payment Intents
  app.get('/api/v1/payment-intents', (_req, res) => {
    res.json({
      object: 'list',
      data: paymentIntentsStore.slice(0, 50),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`KolaPay & KolaPOS Server running on http://0.0.0.0:${PORT}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

startServer();
