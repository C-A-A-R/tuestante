/**
 * ==========================================================================
 * TUESTANTE ADMIN - DIVISIONES GEOGRÁFICAS DE VENEZUELA
 * (VENEZUELA-LOCATIONS.DATA.JS)
 * ==========================================================================
 * Estructura jerárquica: Estados -> Municipios -> Ciudades / Localidades
 * Conforme al modelo de despacho (Shipment):
 * - state (Estado)
 * - municipality (Municipio)
 * - city (Ciudad / Localidad)
 */

export const VENEZUELA_LOCATIONS = {
  "Táchira": {
    "San Cristóbal": ["San Cristóbal", "La Concordia", "Pirineos", "Paramillo", "Puente Real"],
    "Cárdenas": ["Táriba", "Las Vegas de Táriba", "El Diamante", "Barrancas"],
    "Bolívar": ["San Antonio del Táchira", "Palotal", "El Recreo"],
    "Pedro María Ureña": ["Ureña", "Aguas Calientes"],
    "Junín": ["Rubio", "Bramón", "La Petrólea"],
    "Ayacucho": ["San Juan de Colón", "San Félix del Táchira", "Rivas Berti"],
    "Jáuregui": ["La Grita", "Emilio Constantino Guerrero", "Monseñor Miguel Antonio Salas"],
    "Guásimos": ["Palmira", "Toituna", "Cazadero"],
    "Andrés Bello": ["Cordero", "Salomón", "Monte Carmelo"],
    "Torbes": ["San Josecito", "Palmar Nuevo", "Vega de Aza"],
    "Córdoba": ["Santa Ana del Táchira", "Pueblo Nuevo"],
    "Fernández Feo": ["El Piñal", "San Rafael del Piñal", "Alberto Adriani"],
    "Libertad": ["Capacho Viejo", "Cipriano Castro", "Manuel Felipe Rugeles"],
    "Independencia": ["Capacho Nuevo", "Juan Germán Roscio", "Román Cárdenas"],
    "Lobatera": ["Lobatera", "Borotá", "La Parada"],
    "Michelena": ["Michelena", "El Cafetal"],
    "Panamericano": ["Coloncito", "La Palmita"],
    "Samuel Darío Maldonado": ["La Tendida", "Boconó", "Hernández"],
    "Seboruco": ["Seboruco", "Santa Filomena"],
    "Simón Rodríguez": ["San Simón"],
    "Sucre": ["Queniquea", "San Pablo", "Eleazar López Contreras"],
    "Uribante": ["Pregonero", "Cárdenas", "Potosí", "Juan Pablo Peñaloza"],
    "San Judas Tadeo": ["Umuquena"],
    "José María Vargas": ["El Cobre"],
    "Rafael Urdaneta": ["Delicias"],
    "Antonio Rómulo Costa": ["Las Mesas"],
    "García de Hevia": ["La Fría", "Boca de Gamelotal", "José Gregorio Hernández"],
    "Francisco de Miranda": ["San José de Bolívar"]
  },
  "Distrito Capital": {
    "Libertador": ["Caracas", "El Recreo", "Sucre (Catia)", "El Valle", "Caricuao", "La Candelaria", "San Bernardino", "Altagracia", "La Pastora", "San Juan", "Santa Rosalía", "San Pedro", "Coche", "Antímano", "Macarao", "El Junquito", "La Vega", "23 de Enero", "San Agustín", "Santa Teresa", "Catedral"]
  },
  "Miranda": {
    "Chacao": ["Chacao", "Altamira", "El Rosal", "Los Palos Grandes", "La Castellana", "Campo Alegre", "Bello Campo"],
    "Baruta": ["Baruta", "Las Mercedes", "El Cafetal", "Prados del Este", "Santa Fe", "Cumbres de Curumo", "Manzanares"],
    "Sucre": ["Petare", "Los Dos Caminos", "La California", "Boleíta", "Los Ruices", "Macaracuay", "Caucagüita", "Fila de Mariches"],
    "El Hatillo": ["El Hatillo", "La Lagunita", "El Vivero", "Los Naranjos", "Oripoto"],
    "Guaicaipuro": ["Los Teques", "San Pedro de los Altos", "Cecilio Acosta", "Altagracia de la Montaña", "El Jarillo", "Paracotos", "Tacata"],
    "Los Salias": ["San Antonio de los Altos"],
    "Carrizal": ["Carrizal", "Montaña Alta", "Colinas de Carrizal"],
    "Plaza": ["Guarenas", "Nueva Casarapa", "Trapichito"],
    "Zamora": ["Guatire", "Valle Arriba", "Castillejo", "Araira"],
    "Cristóbal Rojas": ["Charallave", "Las Brisas", "La Cabrera"],
    "Tomás Lander": ["Ocumare del Tuy", "La Democracia", "Santa Bárbara"],
    "Urdaneta": ["Cúa", "Nueva Cúa"],
    "Paz Castillo": ["Santa Lucía"],
    "Independencia": ["Santa Teresa del Tuy", "Cartanal"],
    "Simón Bolívar": ["San Francisco de Yare", "San Antonio de Yare"],
    "Brión": ["Higuerote", "Curiepe", "Tacarigua de Brión"],
    "Páez": ["Río Chico", "El Guapo", "Tacarigua de la Laguna", "Paparo"],
    "Buroz": ["Mamporal"],
    "Andrés Bello": ["San José de Barlovento", "Cumbo"],
    "Pedro Gual": ["Cúpira", "Machurucuto"],
    "Acevedo": ["Caucagua", "Aragüita", "Panaquire", "Tapipa", "Marizapa"]
  },
  "Zulia": {
    "Maracaibo": ["Maracaibo", "Chiquinquirá", "Olegario Villalobos", "Juana de Ávila", "Coquivacoa", "Bella Vista", "5 de Julio", "La Limpia", "Los Olivos", "Circunvalación"],
    "San Francisco": ["San Francisco", "El Bajo", "Domitila Flores", "Los Cortijos", "La Coromoto"],
    "Cabimas": ["Cabimas", "Ambrosio", "Carmen Herrera", "Germán Ríos Linares", "San Benito"],
    "Lagunillas": ["Ciudad Ojeda", "Alonso de Ojeda", "Campo Lara", "Eleazar López Contreras"],
    "Santa Rita": ["Santa Rita", "El Mene", "Pedro Lucas Urribarrí"],
    "Miranda": ["Los Puertos de Altagracia", "Altagracia", "Faría", "San Antonio"],
    "Mara": ["San Rafael de El Moján", "Ricaurte", "La Sierrita", "Tamare"],
    "Guajira": ["Sinamaica", "Guajira", "Alta Guajira", "Elías Sánchez Rubio"],
    "Colón": ["San Carlos del Zulia", "Santa Bárbara del Zulia", "El Moralito", "Urribarrí"],
    "Machiques de Perijá": ["Machiques", "San José de Perijá", "Bartolomé de las Casas"],
    "Rosario de Perijá": ["La Villa del Rosario", "El Rosario", "Donaldo García"],
    "Baralt": ["Mene Grande", "San Timoteo", "Libertador", "General Urdaneta"],
    "Valmore Rodríguez": ["Bachaquero", "Rafael Urdaneta", "La Victoria"],
    "Catatumbo": ["Encontrados", "Udong"],
    "Jesús Enrique Lossada": ["La Concepción", "San José", "Mariano Parra León"],
    "Jesús María Semprún": ["Casigua El Cubo", "Jesús María Semprún"],
    "La Cañada de Urdaneta": ["Concepción", "Chiquinquirá", "El Carmelo", "Potreritos"],
    "Francisco Javier Pulgar": ["Pueblo Nuevo El Chivo", "Carlos Quevedo", "Francisco Javier Pulgar"],
    "Sucre": ["Bobures", "Gibraltar", "Heras", "Monseñor Arturo Álvarez"],
    "Simón Bolívar": ["Tía Juana", "Manuel Manrique", "Rafael Maria Baralt"]
  },
  "Carabobo": {
    "Valencia": ["Valencia", "San José", "El Viñedo", "Prebo", "La Granja", "Los Colorados", "Santa Rosa", "Candelaria", "San Blas", "Miguel Peña"],
    "Naguanagua": ["Naguanagua", "La Granja", "Las Quintas", "El Rincón", "Vivienda Rural de Bárbula"],
    "San Diego": ["San Diego", "El Remanso", "Los Jarales", "La Esmeralda", "Pueblo de San Diego"],
    "Guacara": ["Guacara", "Yagua", "Ciudad Alianza"],
    "Puerto Cabello": ["Puerto Cabello", "Bartolomé Salóm", "Fraternidad", "Goaigoaza", "Borburata", "Patuemo"],
    "Los Guayos": ["Los Guayos", "Las Agüitas", "Paraparal"],
    "Libertador": ["Tocuyito", "Independencia"],
    "Bejuma": ["Bejuma", "Canoabo", "Simón Bolívar"],
    "Carlos Arvelo": ["Güigüe", "Belén", "Tacarigua"],
    "Diego Ibarra": ["Mariara", "Aguas Calientes"],
    "Juan José Mora": ["Morón", "Urama"],
    "Miranda": ["Miranda"],
    "Montalbán": ["Montalbán"],
    "San Joaquín": ["San Joaquín"]
  },
  "Aragua": {
    "Girardot": ["Maracay", "Las Delicias", "El Centro", "La Coromoto", "San Jacinto", "Los Samanes", "Calicanto", "Choroní"],
    "Santiago Mariño": ["Turmero", "Samán de Güere", "Chuao", "Alfredo Pacheco Miranda"],
    "José Félix Ribas": ["La Victoria", "Las Mercedes", "Castor Nieves Ríos", "Zuata"],
    "Mario Briceño Iragorry": ["El Limón", "Caña de Azúcar"],
    "Sucre": ["Cagua", "Bella Vista"],
    "Libertador": ["Palo Negro", "San Martín de Porres"],
    "Francisco Linares Alcántara": ["Santa Rita", "Francisco de Miranda", "Monseñor Feliciano González"],
    "Zamora": ["Villa de Cura", "Magdaleno", "San Francisco de Asís", "Tocorón"],
    "Bolívar": ["San Mateo"],
    "José Ángel Lamas": ["Santa Cruz de Aragua"],
    "San Casimiro": ["San Casimiro", "Güiripa", "Ollas de Caramacate"],
    "San Sebastián": ["San Sebastián de los Reyes"],
    "Urdaneta": ["Barbacoas", "Las Peñitas", "San Francisco de Cara", "Taguay"],
    "Camatagua": ["Camatagua", "Carmen de Cura"],
    "Costa de Oro": ["Ocumare de la Costa", "Cuyagua", "Cata"],
    "Tovar": ["Colonia Tovar"],
    "Santos Michelena": ["Las Tejerías", "Tiara"],
    "José Rafael Revenga": ["El Consejo"]
  },
  "Lara": {
    "Iribarren": ["Barquisimeto", "Catedral", "Santa Rosa", "Concepción", "Juan de Villegas", "Unión", "El Cují", "Tamaca"],
    "Palavecino": ["Cabudare", "José Gregorio Bastidas", "Agua Viva", "La Piedad"],
    "Torres": ["Carora", "Trinidad Samuel", "Antonio Díaz", "Camacaro", "Castañeda", "Chiquinquirá"],
    "Jiménez": ["Quíbor", "Juan Bautista Rodríguez", "Cuara", "Diego de Lozada"],
    "Morán": ["El Tocuyo", "Bolívar", "Guárico", "Anzoátegui", "Humocaro Alto", "Humocaro Bajo"],
    "Crespo": ["Duaca", "Freitez", "José María Blanco"],
    "Andrés Eloy Blanco": ["Sanare", "Pío Tamayo", "Yacambú"],
    "Urdaneta": ["Siquisique", "Moroturo", "San Miguel", "Xaguas"],
    "Simón Planas": ["Sarare", "Gustavo Vega León", "Buría"]
  },
  "Anzoátegui": {
    "Simón Bolívar": ["Barcelona", "El Carmen", "San Cristóbal", "Naricual", "Bergantín"],
    "Juan Antonio Sotillo": ["Puerto La Cruz", "Pozuelos"],
    "Diego Bautista Urbaneja": ["Lechería", "El Morro"],
    "Guanta": ["Guanta", "Chorrerón"],
    "Anaco": ["Anaco", "San Joaquín", "Buena Vista"],
    "Simón Rodríguez": ["El Tigre", "Edmundo Barrios", "Miguel Otero Silva"],
    "Guanipa": ["San José de Guanipa (El Tigrito)"],
    "Aragua": ["Aragua de Barcelona", "Cachipo"],
    "Pedro María Freites": ["Cantaura", "Libertador", "Santa Rosa", "Urica"],
    "Píritu": ["Píritu", "San Francisco"],
    "Fernando de Peñalver": ["Puerto Píritu", "San Miguel", "Sucre"],
    "Francisco de Miranda": ["Pariaguán", "Atapirire", "Boca del Pao", "El Pao"],
    "José Gregorio Monagas": ["Mapire", "Piar", "San Diego de Cabrutica", "Uverito"],
    "Independencia": ["Soledad", "Mamo"],
    "Libertad": ["San Mateo", "El Carito", "Santa Inés"],
    "Sir Arthur McGregor": ["El Chaparro", "Tomás Alfaro Calatrava"],
    "Santa Ana": ["Santa Ana", "Pueblo Nuevo"],
    "San Juan de Capistrano": ["Boca de Uchire", "Boca de Chávez"],
    "Manuel Ezequiel Bruzual": ["Clarines", "Guanape", "Sabana de Uchire"],
    "Francisco del Carmen Carvajal": ["Valle de Guanape", "Santa Bárbara"],
    "Juan Manuel Cajigal": ["Onoto", "San Pablo"]
  },
  "Bolívar": {
    "Caroní": ["Ciudad Guayana", "Puerto Ordaz", "San Félix", "Unare", "Universidad", "Dalla Costa", "Vista al Sol"],
    "Angostura del Orinoco": ["Ciudad Bolívar", "Catedral", "Agua Salada", "Vista Hermosa", "La Sabanita", "José Antonio Páez"],
    "Piar": ["Upata", "Andrés Eloy Blanco", "Pedro Cova"],
    "Roscio": ["Guasipati", "Salóm"],
    "El Callao": ["El Callao"],
    "Sifontes": ["Tumeremo", "Dalla Costa", "San Isidro"],
    "Gran Sabana": ["Santa Elena de Uairén", "Ikabarú"],
    "Cedeño": ["Caicara del Orinoco", "Altagracia", "Ascensión Farreras", "Guaniamo"],
    "Sucre": ["Maripa", "Aripao", "Guarataro", "Las Majadas"],
    "Angostura": ["Ciudad Piar", "Raúl Leoni", "Barceloneta", "Santa Bárbara"],
    "Padre Pedro Chien": ["El Palmar"]
  },
  "Mérida": {
    "Libertador": ["Mérida", "Sagrario", "Milla", "Gonzalo Picón Febres", "Arias", "El Llano", "Domingo Peña", "Lasso de la Vega", "Osuna Rodríguez"],
    "Campo Elías": ["Ejido", "Montalbán", "Matriz", "Fernández Peña", "Jají", "La Mesa", "San José del Sur"],
    "Alberto Adriani": ["El Vigía", "Presidente Betancourt", "Presidente Páez", "Presidente Rómulo Gallegos", "Gabriel Picón González"],
    "Santos Marquina": ["Tabay"],
    "Sucre": ["Lagunillas", "Chiguará", "Estánquez", "San Juan", "Pueblo Nuevo del Sur"],
    "Tovar": ["Tovar", "El Amparo", "San Francisco", "El Llano"],
    "Rivas Dávila": ["Bailadores", "Gerónimo Maldonado"],
    "Rangel": ["Mucuchíes", "Cacute", "La Toma", "Mucurubá", "San Rafael"],
    "Cardenal Quintero": ["Santo Domingo", "Las Piedras"],
    "Miranda": ["Timotes", "Andrés Eloy Blanco", "Chachopo", "Piñango"],
    "Pueblo Llano": ["Pueblo Llano"],
    "Caracciolo Parra Olmedo": ["Tucaní", "Florencio Ramírez"],
    "Obispo Ramos de Lora": ["Santa Elena de Arenales", "Eloy Paredes", "San Rafael de Alcázar"],
    "Andrés Bello": ["La Azulita"],
    "Antonio Pinto Salinas": ["Santa Cruz de Mora", "Mesa Bolívar", "Mesa de Las Palmas"],
    "Zea": ["Zea", "Caño El Tigre"],
    "Guaraque": ["Guaraque", "Mesa de Quintero", "Río Negro"],
    "Arzobispo Chacón": ["Canaguá", "Capurí", "Chacantá", "El Molino", "Guaimaral", "Mucutuy", "Mucuchachí"],
    "Aricagua": ["Aricagua", "San Antonio"],
    "Justo Briceño": ["Torondoy", "San Cristóbal de Torondoy"],
    "Julio César Salas": ["Arapuey", "Palmira"],
    "Tulio Febres Cordero": ["Nueva Bolivia", "Independencia", "María de la Concepción Palacios", "Santa Apolonia"],
    "Padre Noguera": ["Santa María de Caparo"]
  },
  "Falcón": {
    "Miranda": ["Coro", "San Gabriel", "Santa Ana", "San Antonio", "Guzmán Guillermo", "Sabaneta"],
    "Carirubana": ["Punto Fijo", "Norte", "Carirubana", "Punta Cardón", "Santa Ana"],
    "Los Taques": ["Judibana", "Los Taques"],
    "Falcón": ["Pueblo Nuevo", "Adícora", "Baraived", "Buena Vista", "Jadacaquiva", "Moruy"],
    "Colina": ["La Vela de Coro", "Las Calderas", "Acurigua", "Guaibacoa"],
    "Silva": ["Tucacas", "Boca de Aroa"],
    "Monseñor Iturriza": ["Chichiriviche", "Boca de Tocuyo", "Tocuyo de la Costa"],
    "Zamora": ["Puerto Cumarebo", "La Ciénaga", "La Soledad", "Pueblo Cumarebo"],
    "Acosta": ["San Juan de los Cayos", "Capadare", "La Pastora", "Libertador"],
    "Bolívar": ["San Luis", "Aracua", "La Peña"],
    "Buchivacoa": ["Capatárida", "Bariro", "Borojó", "Guajiro", "Seque", "Zazarida", "Valle de Eroa"],
    "Cacique Manaure": ["Yaracal"],
    "Dabajuro": ["Dabajuro"],
    "Democracia": ["Pedregal", "Agua Clara", "Acurigua", "Purureche"],
    "Federación": ["Churuguara", "Agua Larga", "El Paují", "Independencia", "Mapararí"],
    "Mauroa": ["Mene de Mauroa", "Casigua", "San Félix"],
    "Palma Sola": ["Palmasola"],
    "Petit": ["Cabure", "Colina", "Curimagua"],
    "Píritu": ["Píritu", "San José de la Costa"],
    "San Francisco": ["Mirimire"],
    "Sucre": ["Sucre", "Pecaya"],
    "Tocópero": ["Tocópero"],
    "Unión": ["Santa Cruz de Bucaral", "El Charal", "Las Vegas del Tuy"],
    "Urumaco": ["Urumaco", "Bruzual"]
  },
  "Barinas": {
    "Barinas": ["Barinas", "Alto Barinas", "Corazón de Jesús", "El Carmen", "Rómulo Betancourt", "San Silvestre", "Santa Inés", "Torunos"],
    "Pedraza": ["Ciudad Bolivia", "Ignacio Briceño", "José Félix Ribas", "Páez"],
    "Antonio José de Sucre": ["Socopó", "Nicolás Pulido", "Andrés Bello"],
    "Alberto Arvelo Torrealba": ["Sabaneta", "Rodríguez Domínguez"],
    "Cruz Paredes": ["Barrancas", "El Socorro", "Masparrito"],
    "Ezequiel Zamora": ["Santa Bárbara", "Pedro Briceño Méndez", "Ramón Ignacio Méndez", "José Ignacio del Pumar"],
    "Obispos": ["Obispos", "El Real", "La Luz", "Los Guasimitos"],
    "Rojas": ["Libertad", "Dolores", "Palacio Fajardo", "Santa Rosa"],
    "Sosa": ["Ciudad de Nutrias", "El Regalo", "Puerto Nutrias", "Santa Catalina"],
    "Bolívar": ["Barinitas", "Altamira de Cáceres", "Calderas"],
    "Andrés Eloy Blanco": ["El Cantón", "Santa Cruz de Guacas", "Puerto Vivas"],
    "Arismendi": ["Arismendi", "Guadarrama", "La Unión", "San Antonio"]
  },
  "Monagas": {
    "Maturín": ["Maturín", "Alto de Los Godos", "Boquerón", "Las Cocuizas", "San Simón", "Santa Cruz", "El Furrial", "Jusepín", "La Pica", "San Vicente"],
    "Ezequiel Zamora": ["Punta de Mata", "El Tejero"],
    "Caripe": ["Caripe", "El Guácharo", "La Guanota", "Sabana de Piedra", "San Agustín", "Teresen"],
    "Cedeño": ["Caicara de Maturín", "Areo", "San Félix de Cantauro", "Viento Fresco"],
    "Piar": ["Aragua de Maturín", "Aparicio", "Chaguaramal", "El Pinto", "Guanaguana", "La Toscana", "Taguaya"],
    "Bolívar": ["Caripito"],
    "Acosta": ["San Antonio de Capayacuar", "San Francisco de Maturín"],
    "Aguasay": ["Aguasay"],
    "Punceres": ["Quiriquire", "Cachipo"],
    "Santa Bárbara": ["Santa Bárbara"],
    "Uracoa": ["Uracoa"],
    "Sotillo": ["Barrancas del Orinoco", "Los Barrancos de Fajardo"],
    "Libertador": ["Temblador", "Chaguaramas", "Las Albinas", "Tabasca"]
  },
  "Sucre": {
    "Sucre": ["Cumaná", "Altagracia", "Santa Inés", "Valentín Valiente", "Ayacucho", "San Juan", "Raúl Leoni", "Gran Mariscal"],
    "Bermúdez": ["Carúpano", "Santa Catalina", "Santa Rosa", "Bolívar", "Macarapana"],
    "Montes": ["Cumanacoa", "Arenas", "Aricagua", "Cocollar", "San Fernando", "San Lorenzo"],
    "Ribero": ["Cariaco", "Catuaro", "Rendón", "Santa Cruz", "Santa María"],
    "Arismendi": ["Río Caribe", "Antonio José de Sucre", "El Morro de Puerto Santo", "Puerto Santo", "San Juan de las Galdonas"],
    "Benítez": ["El Pilar", "El Rincón", "General Francisco Antonio Vásquez", "Guaraúnos", "Tunapuicito", "Unión"],
    "Cajigal": ["Yaguaraparo", "El Paujil", "Libertad"],
    "Libertador": ["Tunapuy", "Campo Elías"],
    "Mariño": ["Irapa", "Campo Claro", "Marabal", "San Antonio de Irapa", "Soro"],
    "Mejía": ["San Antonio del Golfo"],
    "Cruz Salmerón Acosta": ["Araya", "Chacopata", "Manicuare"],
    "Valdez": ["Güiria", "Bideau", "Cristóbal Colón", "Punta de Piedras"],
    "Andrés Eloy Blanco": ["Casanay", "Mariño"],
    "Andrés Mata": ["San José de Aerocuar", "Tavera Acosta"],
    "Bolívar": ["Marigüitar"]
  },
  "Portuguesa": {
    "Páez": ["Acarigua", "Payara", "Pimpinela", "Ramón Peraza"],
    "Araure": ["Araure", "Río Acarigua"],
    "Guanare": ["Guanare", "Córdoba", "San José de la Montaña", "San Juan de Guanaguanare", "Virgen de la Coromoto"],
    "Turén": ["Villa Bruzual", "Canelones", "Santa Cruz", "San Isidro Labrador"],
    "Agua Blanca": ["Agua Blanca"],
    "Esteller": ["Píritu", "Uveral"],
    "Guanarito": ["Guanarito", "Trinidad de la Capilla", "Divina Pastora"],
    "Monseñor José Vicente de Unda": ["Paraíso de Chabasquén", "Peña Blanca"],
    "Ospino": ["Ospino", "Aparición", "La Estación"],
    "Papelón": ["Papelón", "Caño Delgadito"],
    "San Genaro de Boconoíto": ["Boconoíto", "Antolín Tovar"],
    "San Rafael de Onoto": ["San Rafael de Onoto", "Santa Fe", "Thermo Morles"],
    "Santa Rosalía": ["El Playón", "Florida"],
    "Sucre": ["Biscucuy", "Concepción", "San José de Saguaz", "San Rafael de Palo Alzado", "Uvencio Antonio Velásquez", "Villa Rosa"]
  },
  "Trujillo": {
    "Valera": ["Valera", "Juan Ignacio Montilla", "La Beatriz", "Mercedes Díaz", "San Luis", "Mendoza Fría", "La Puerta"],
    "Trujillo": ["Trujillo", "Andrés Linares", "Chiquinquirá", "Cristóbal Mendoza", "Cruz Carrillo", "Matriz", "Monseñor Carrillo", "Tres Esquinas"],
    "Boconó": ["Boconó", "El Carmen", "Mosquey", "Ayacucho", "Burbusay", "General Ribas", "Guanche", "Monseñor Jáuregui", "Rafael Rangel", "San José", "San Miguel", "Vega de Guaramacal"],
    "Carache": ["Carache", "Cuicas", "La Concepción", "Panamericana", "Santa Cruz"],
    "Escuque": ["Escuque", "La Unión", "Santa Rita", "Sabana Libre"],
    "Pampán": ["Pampán", "Flor de Patria", "La Paz", "Santa Ana"],
    "Pampanito": ["Pampanito", "La Concepción", "Pampanito II"],
    "Rafael Rangel": ["Betijoque", "José Gregorio Hernández", "La Pueblita", "Los Cedros"],
    "San Rafael de Carvajal": ["Carvajal", "Campo Alegre", "Antonio Nicolás Briceño", "José Leonardo Suárez"],
    "Sucre": ["Sabana de Mendoza", "Junín", "Valmore Rodríguez", "El Paraíso"],
    "Urdaneta": ["La Quebrada", "Cabimbú", "Jajó", "La Mesa de Esnujaque", "Santiago", "Tuñame"],
    "Andrés Bello": ["Santa Isabel", "Araguaney", "El Jagüito", "La Esperanza"],
    "Bolívar": ["Sabana Grande", "Cheregüé", "Granados"],
    "Candelaria": ["Chejendé", "Arnoldo Gabaldón", "Bolivia", "Carrillo", "Cegarra", "Manuel Salvador Ulloa", "San José"],
    "José Felipe Márquez Cañizales": ["El Paradero", "Antonio José de Sucre", "El Socorro"],
    "Juan Vicente Campo Elías": ["Campo Elías", "Arnoldo Gabaldón"],
    "La Ceiba": ["Santa Apolonia", "El Progreso", "La Ceiba", "Tres de Febrero"],
    "Miranda": ["El Dividive", "Agua Santa", "Agua Caliente", "El Cenizo", "Valerita"],
    "Monte Carmelo": ["Monte Carmelo", "Buena Vista", "Santa María del Palmar"],
    "Motatán": ["Motatán", "El Baño", "Jalisco"]
  },
  "Yaracuy": {
    "San Felipe": ["San Felipe", "Albarico", "San Javier"],
    "Independencia": ["Independencia"],
    "Cocorote": ["Cocorote"],
    "Peña": ["Yaritagua", "San Andrés"],
    "Bruzual": ["Chivacoa", "Campo Elías"],
    "Nirgua": ["Nirgua", "Salóm", "Temerla"],
    "Arístides Bastidas": ["San Pablo"],
    "Bolívar": ["Aroa"],
    "Manuel Monge": ["Yumare"],
    "La Trinidad": ["Boraure"],
    "José Antonio Páez": ["Sabana de Parra"],
    "Sucre": ["Guama"],
    "Urachiche": ["Urachiche"],
    "Veroes": ["Farriar", "El Guayabo"]
  },
  "Guárico": {
    "Juan Germán Roscio": ["San Juan de los Morros", "Cantagallo", "Parapara"],
    "Francisco de Miranda": ["Calabozo", "El Calvario", "El Rastro", "Guardatinajas"],
    "Leonardo Infante": ["Valle de la Pascua", "Espino"],
    "Zaraza": ["Zaraza", "San José de Unare"],
    "Camaguán": ["Camaguán", "Puerto Miranda", "Uverito"],
    "Chaguaramas": ["Chaguaramas"],
    "El Socorro": ["El Socorro"],
    "José Félix Ribas": ["Tucupido", "San Rafael de Laya"],
    "José Tadeo Monagas": ["Altagracia de Orituco", "San Francisco de Macaira", "San Rafael de Orituco", "Soublette", "Paso Real de Macaira"],
    "Juan José Rondón": ["Las Mercedes del Llano", "Cabruta", "Santa Rita de Manapire"],
    "Julián Mellado": ["El Sombrero", "Sosa"],
    "Ortiz": ["Ortiz", "San Francisco de Tiznados", "San José de Tiznados", "San Lorenzo de Tiznados"],
    "San Gerónimo de Guayabal": ["Guayabal", "Cazorla"],
    "San José de Guaribe": ["San José de Guaribe"],
    "Santa María de Ipire": ["Santa María de Ipire", "Altamira"]
  },
  "Nueva Esparta": {
    "Mariño": ["Porlamar"],
    "Maneiro": ["Pampatar", "Los Robles"],
    "Arismendi": ["La Asunción"],
    "García": ["El Valle del Espíritu Santo", "San Antonio"],
    "Gómez": ["Santa Ana", "Altagracia", "Pedro González", "Tacarigua"],
    "Díaz": ["San Juan Bautista", "Zabala", "El Yaque"],
    "Marcano": ["Juan Griego", "Adrián"],
    "Antolín del Campo": ["La Plaza de Paraguachí", "Playa El Agua", "Manzanillo"],
    "Tubores": ["Punta de Piedras", "Los Baleales"],
    "Villalba": ["San Pedro de Coche"],
    "Península de Macanao": ["Boca de Río", "San Francisco"]
  },
  "Apure": {
    "San Fernando": ["San Fernando de Apure", "El Recreo", "Peñalver", "San Rafael de Atamaica"],
    "Páez": ["Guasdualito", "Aramendi", "El Amparo", "San Camilo", "Urdaneta"],
    "Achaguas": ["Achaguas", "Apurito", "El Yagual", "Guachara", "Mucuritas", "Queseras del Medio"],
    "Biruaca": ["Biruaca"],
    "Muñoz": ["Bruzual", "Mantecal", "Quintero", "Rincón Hondo", "San Vicente"],
    "Pedro Camejo": ["San Juan de Payara", "Codazzi", "Cunaviche"],
    "Rómulo Gallegos": ["Elorza", "La Trinidad de Orichuna"]
  },
  "Cojedes": {
    "Ezequiel Zamora": ["San Carlos", "Juan Ángel Bravo", "Manuel Manrique"],
    "Tinaquillo": ["Tinaquillo"],
    "Tinaco": ["Tinaco", "General en Jefe José Laurencio Silva"],
    "Anzoátegui": ["Cojedes", "Juan de Mata Suárez"],
    "Pao de San Juan Bautista": ["El Pao"],
    "Ricaurte": ["Libertad de Cojedes", "El Amparo"],
    "Rómulo Gallegos": ["Las Vegas"],
    "Girardot": ["El Baúl", "Sucre"],
    "Lima Blanco": ["Macapo", "La Aguadita"]
  },
  "La Guaira": {
    "Vargas": ["La Guaira", "Maiquetía", "Catia La Mar", "Caraballeda", "Macuto", "Naiguatá", "Carayaca", "El Junko", "Carlos Soublette", "Urimare", "Caruao"]
  },
  "Amazonas": {
    "Atures": ["Puerto Ayacucho", "Fernando Girón Tovar", "Luis Alberto Gómez", "Parhueña", "Platanillal"],
    "Alto Orinoco": ["La Esmeralda", "Huachamacare", "Marawaka", "Sierra Parima"],
    "Atabapo": ["San Fernando de Atabapo", "Ucata", "Yapacana", "Caname"],
    "Autana": ["Isla Ratón", "Samariapo", "Sipapo", "Munduapo", "Guayapo"],
    "Manapiare": ["San Juan de Manapiare", "Alto Ventuari", "Bajo Ventuari", "Medio Ventuari"],
    "Maroa": ["Maroa", "Victorino", "Comunidad"],
    "Río Negro": ["San Carlos de Río Negro", "Solano", "Casiquiare", "Cocuy"]
  },
  "Delta Amacuro": {
    "Tucupita": ["Tucupita", "San José", "San Rafael", "Virgen del Valle", "Leonardo Ruiz Pineda", "Mariscal Antonio José de Sucre", "Monseñor Argimiro García", "Juan Millán"],
    "Casacoima": ["Sierra Imataca", "Imataca", "Cinco de Julio", "Manuel Piar", "Rómulo Gallegos"],
    "Antonio Díaz": ["Curiapo", "Almirante Luis Brión", "Francisco Aniceto Lugo", "Manuel Renaud", "Padre Barral", "Santos de Abelgas"],
    "Pedernales": ["Pedernales", "Capure"]
  }
};

/**
 * Obtiene la lista ordenada de todos los Estados disponibles.
 * @returns {string[]}
 */
export function getVenezuelaStates() {
  return Object.keys(VENEZUELA_LOCATIONS).sort();
}

/**
 * Obtiene la lista de municipios pertenecientes a un estado dado.
 * @param {string} stateName Nombre del estado
 * @returns {string[]}
 */
export function getMunicipalitiesByState(stateName) {
  if (!stateName || !VENEZUELA_LOCATIONS[stateName]) {
    return [];
  }
  return Object.keys(VENEZUELA_LOCATIONS[stateName]).sort();
}

/**
 * Obtiene la lista de ciudades o localidades pertenecientes a un municipio y estado dados.
 * @param {string} stateName Nombre del estado
 * @param {string} municipalityName Nombre del municipio
 * @returns {string[]}
 */
export function getCitiesByMunicipality(stateName, municipalityName) {
  if (!stateName || !municipalityName || !VENEZUELA_LOCATIONS[stateName] || !VENEZUELA_LOCATIONS[stateName][municipalityName]) {
    return [];
  }
  return VENEZUELA_LOCATIONS[stateName][municipalityName];
}
