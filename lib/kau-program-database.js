// Karlstad runtime database. The generated file is produced from the fully audited KAU catalogue.
import {KAU_GENERATED_PROGRAMS,getKauGeneratedProgram} from './kau-program-database.generated.js';

export const KAU_PROGRAM_DB=KAU_GENERATED_PROGRAMS;
export function getKauProgram(code){return getKauGeneratedProgram(code)}
