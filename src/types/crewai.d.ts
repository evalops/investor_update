declare module 'crewai' {
  // Lightweight runtime value exports with loose typing for type-checking
  // This prevents TypeScript from parsing the package's TS source in node_modules
  export const Agent: any;
  export const Task: any;
  export const Crew: any;
}

