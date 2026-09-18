import 'dotenv/config';

import express from 'express';
import { serve } from 'inngest/express';
import { inngest } from './inngest/client.js';
import { functions } from './inngest/functions/index.js';

const app = express();

app.use(express.json());

app.use('/api/inngest', serve({ client: inngest, functions }));

// todo: create a webhook in github to make this webhook req on every pr.
// app.post('/webhook/github', (req, res) => {
//   inngest.send({ name: 'github/pullrequest.review', data: {
//     owner: req.body,
//     repo,
//     .. all your data here
//   }});
// });

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
