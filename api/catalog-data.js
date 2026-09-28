import offerings from '../lib/api-handlers/canonical-offerings.js';
import history from '../lib/api-handlers/credit-transfer-history.js';
import syllabus from '../lib/api-handlers/syllabus.js';

const routes={
  'canonical-offerings':offerings,
  'credit-transfer-history':history,
  syllabus
};

export default function handler(req,res){
  const route=String(req.query?.route||'');
  const selected=routes[route];
  if(!selected)return res.status(404).json({error:'Unknown catalogue route'});
  return selected(req,res);
}
