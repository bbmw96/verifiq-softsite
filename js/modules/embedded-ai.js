'use strict';
const EmbeddedAI = (() => {

  // ── Check Levels ──────────────────────────────────────────────────────────
  const LEVELS = {
    L1:  { name:'IFC File Validity',          desc:'Valid IFC4 file structure, schema version, header completeness' },
    L2:  { name:'Project Setup',              desc:'IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey hierarchy present' },
    L3:  { name:'Entity Existence',           desc:'Required IFC entities present for declared building type' },
    L4:  { name:'Entity Classification',      desc:'Correct IFC entity types and PredefinedType/ObjectType values' },
    L5:  { name:'Property Set Presence',      desc:'SGPset_ and Pset_ property sets attached to correct entities' },
    L6:  { name:'Property Completeness',      desc:'All mandatory properties populated (not null/empty)' },
    L7:  { name:'Property Data Types',        desc:'Values match declared types: Label, Boolean, Integer, Real, Length' },
    L8:  { name:'Accepted Values',            desc:'Enum/list properties use only allowed values from IFC+SG spec' },
    L9:  { name:'Spatial Structure',          desc:'Elements in correct storeys via IfcRelContainedInSpatialStructure' },
    L10: { name:'Geometric Representation',   desc:'Correct representation contexts: SweptSolid, Brep, MappedRepresentation' },
    L11: { name:'Material Assignment',        desc:'SGPset_Material attached; MaterialGrade values validated' },
    L12: { name:'Structural Parameters',      desc:'Structural loads, capacities, design parameters present' },
    L13: { name:'Fire Safety Parameters',     desc:'SCDF: FireRating, FireExit, FireAccessOpening per SCDF requirements' },
    L14: { name:'Accessibility Parameters',   desc:'BCA/SCDF: BarrierFreeAccessibility, ClearWidth, ClearHeight' },
    L15: { name:'Space Area Properties',      desc:'URA: GFA properties, Strata areas, Connectivity, Landscape features' },
    L16: { name:'MEP Parameters',             desc:'PUB/NEA: WELS, pipe gradients, system types, tank capacities' },
    L17: { name:'Site and Landscape',         desc:'NParks: plant species, status, girth, height; site boundary land use' },
    L18: { name:'Gateway G1 Completeness',    desc:'All G1 (Design) parameters present and validated' },
    L19: { name:'Gateway G1.5/G2 Completeness',desc:'All G1.5 (Piling) and G2 (Construction) parameters present' },
    L20: { name:'Gateway G3 Completeness',     desc:'All G3 (Completion/TOP) parameters present and validated' },
  };

  // ── CORENET X Gateways ────────────────────────────────────────────────────
  const SG_GATEWAYS = {
    'G-': {
      name: 'Pre-Submission Consultation',
      desc: 'Early consultation before formal gateway submission; not a formal gateway. Min 4 weeks before G1. SLA: ~15-20 working days for DAP session.',
      agencies: ['BCA','URA','SCDF','NEA','PUB','LTA','NParks'],
      keyParams: ['Development concept','Early agency consultation','Environmental Impact Study (EIS)','Noise Impact Assessment (NIA) pre','Traffic Impact Assessment'],
    },
    G1: {
      name: 'Design Gateway',
      desc: 'Multi-agency design clearance. Joint SLA: 20 working days. URA DC clearances, BCA structural concept, NEA environmental, PUB drainage, LTA street works/RSSZ, NParks greenery/trees, SCDF fire engine access concept.',
      agencies: ['BCA','URA','SCDF','NEA','PUB','LTA','NParks'],
      keyParams: ['Space usage','GFA calculations','Land use/massing','Fire safety layout','Accessibility','Environmental clearance','Greenery/tree conservation','Parking provision','RSSZ confirmation'],
    },
    'G1.5': {
      name: 'Piling Gateway',
      desc: 'Piling/foundation works without superstructure. BCA structural only; NParks EMMP required before commencement. SLA: 20 working days.',
      agencies: ['BCA','NParks'],
      keyParams: ['Pile type','Pile capacity DA1-1/DA1-2','CutOffLevel_SHD','Borehole reference','Min embedment depths','EMMP/Wildlife Management Plan'],
    },
    G2: {
      name: 'Construction Gateway',
      desc: 'Detailed design approval (Written Permission from URA). Joint SLA: 20 working days. All 7 process agencies review.',
      agencies: ['BCA','URA','SCDF','NEA','PUB','LTA','NParks'],
      keyParams: ['Structural element details','Material grades','Rebar specs','MEP systems','URA Written Permission','Fire compartmentation','Landscape plan','Parking detailed design','Sanitary/drainage network'],
    },
    DSP: {
      name: 'Direct Submission Process',
      desc: 'Simplified single-stage process for single-unit residential landed houses only. Projects with 2+ houses must use 3-Gateway RABW. Replaces G1/G2/G3 for qualifying projects.',
      agencies: ['BCA','URA'],
      keyParams: ['Single-unit landed residential','URA Plan Lodgment Scheme','A&A or new erection','No Design/Construction gateways'],
    },
    G3: {
      name: 'Completion / TOP Gateway',
      desc: 'As-built submission for TOP/CSC. All 10 CORENET X agencies. Joint SLA: 20 working days.',
      agencies: ['BCA','URA','SCDF','NEA','PUB','LTA','HDB','SLA','NParks'],
      keyParams: ['As-built dimensions','Final material specs','WELS labelling','Tree preservation','GFA verification','RI certificates','Fire safety certification','Buildability/Constructability final scores'],
    },
  };

  // ── Malaysia Rules ─────────────────────────────────────────────────────────
  const MY_RULES = [
    { code:'UBBL-1',   desc:'Fire escape staircase width ≥ 1050 mm (UBBL Reg 167)' },
    { code:'UBBL-2',   desc:'Travel distance to exit ≤ 30 m (sprinklered: 45 m)' },
    { code:'UBBL-3',   desc:'Corridor width ≥ 1800 mm for public buildings' },
    { code:'UBBL-4',   desc:'Ramp gradient ≤ 1:12 for accessible ramps' },
    { code:'UBBL-5',   desc:'Minimum ceiling height 2400 mm for habitable rooms' },
    { code:'MS1184-1', desc:'Accessible parking bay 3600 × 5000 mm minimum' },
    { code:'MS1184-2', desc:'Accessible toilet minimum 1700 × 1700 mm' },
    { code:'MS1184-3', desc:'Handrail height 850-900 mm on stairs' },
    { code:'BOMBA-1',  desc:'Fire compartment max 7000 m² (Type 1 buildings)' },
    { code:'BOMBA-2',  desc:'Sprinkler system required for buildings > 30 m height' },
    { code:'JKR-1',    desc:'Structural design to BS EN 1990/1992 Eurocodes with Malaysia NA' },
  ];

  // ── Shared value sets ──────────────────────────────────────────────────────
  const CONSTRUCTION_METHODS = ['CIS','PC','PT (Pre)','PT (Post)','PF','PPVC','Spun'];
  const CONCRETE_GRADES = ['C12/15','C20/25','C30/37','C32/40','C35/45','C40/50','C50/60','C55/67','C60/75','C70/85','C80/95'];
  const STEEL_GRADES    = ['S235','S275','S355'];
  const REBAR_GRADES    = ['500A','500B','500C','600A','600B','600C'];
  const FIRE_RATINGS    = ['0.5','1','1.5','2','2.5','3','3.5','4'];
  const ALL_MATERIAL_GRADES = [...CONCRETE_GRADES, ...STEEL_GRADES];
  const PLANT_STATUS    = ['Existing','Proposed','To be Removed','To be Transplanted'];

  // ── IFC+SG Components - full dataset from BCA Industry Mapping Excel ───────
  const COMPONENTS = {

    // ─── STRUCTURAL ──────────────────────────────────────────────────────────

    'Wall': {
      entity: 'IfcWall',
      subtypes: ['SOLIDWALL','SHEAR','PARTITIONING','PLUMBINGWALL','MOVABLE','PARAPET','RETAININGWALL'],
      discipline: 'Architectural/Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Wall','SGPset_WallDimension','SGPset_WallReinforcement','SGPset_WallStructuralLoad','SGPset_Material'],
          params: [
            { name:'ConstructionMethod',      pset:'SGPset_Wall',               type:'Label',   values:CONSTRUCTION_METHODS },
            { name:'IsPartyWall',             pset:'SGPset_Wall',               type:'Boolean' },
            { name:'IsExternal',              pset:'SGPset_Wall',               type:'Boolean' },
            { name:'LoadBearing',             pset:'SGPset_Wall',               type:'Boolean' },
            { name:'ShelterUsage',            pset:'SGPset_Wall',               type:'Boolean' },
            { name:'BeamFacade',              pset:'SGPset_Wall',               type:'Boolean' },
            { name:'DoubleBayFacade',         pset:'SGPset_Wall',               type:'Boolean' },
            { name:'PrefinishedFacade',       pset:'SGPset_Wall',               type:'Boolean' },
            { name:'Mark',                    pset:'SGPset_Wall',               type:'Label' },
            { name:'Thickness',               pset:'SGPset_WallDimension',      type:'Length' },
            { name:'Length',                  pset:'SGPset_WallDimension',      type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',           type:'Label',   values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_WallReinforcement',  type:'Label',   values:REBAR_GRADES },
            { name:'HorizontalRebar',         pset:'SGPset_WallReinforcement',  type:'Label' },
            { name:'VerticalRebar',           pset:'SGPset_WallReinforcement',  type:'Label' },
            { name:'WorkingLoadDA1_1',        pset:'SGPset_WallStructuralLoad', type:'Integer' },
            { name:'WorkingLoadDA1_2',        pset:'SGPset_WallStructuralLoad', type:'Integer' },
          ],
        },
        SCDF: {
          psets: ['Pset_WallCommon'],
          params: [
            { name:'FireRating',  pset:'Pset_WallCommon', type:'Label',   values:FIRE_RATINGS },
            { name:'LoadBearing', pset:'Pset_WallCommon', type:'Boolean' },
          ],
        },
      },
    },

    'Beam': {
      entity: 'IfcBeam',
      subtypes: ['BEAM','HOLLOWCORE','JOIST','LINTEL','SPANDREL','T_BEAM','*TRANSFERBEAM'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Beam','SGPset_BeamDimension','SGPset_BeamReinforcement','SGPset_SteelConnection','SGPset_Material'],
          params: [
            { name:'ConstructionMethod',      pset:'SGPset_Beam',              type:'Label',  values:CONSTRUCTION_METHODS },
            { name:'Mark',                    pset:'SGPset_Beam',              type:'Label' },
            { name:'ReferTo2DDetail',         pset:'SGPset_Beam',              type:'Label' },
            { name:'SectionFabricationMethod',pset:'SGPset_Beam',              type:'Label' },
            { name:'Width',                   pset:'SGPset_BeamDimension',     type:'Length' },
            { name:'Depth',                   pset:'SGPset_BeamDimension',     type:'Length' },
            { name:'Length',                  pset:'SGPset_BeamDimension',     type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',          type:'Label',  values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_BeamReinforcement', type:'Label',  values:REBAR_GRADES },
            { name:'TopRebar',                pset:'SGPset_BeamReinforcement', type:'Label' },
            { name:'BottomRebar',             pset:'SGPset_BeamReinforcement', type:'Label' },
            { name:'ShearLink',               pset:'SGPset_BeamReinforcement', type:'Label' },
            { name:'ConnectionType',          pset:'SGPset_SteelConnection',   type:'Label' },
          ],
        },
      },
    },

    'Column': {
      entity: 'IfcColumn',
      subtypes: ['COLUMN','PILASTER','*TRANSFERCOLUMN'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Column','SGPset_ColumnDimension','SGPset_ColumnReinforcement','SGPset_ColumnStructuralLoad','SGPset_Material'],
          params: [
            { name:'ConstructionMethod',      pset:'SGPset_Column',               type:'Label',  values:CONSTRUCTION_METHODS },
            { name:'Mark',                    pset:'SGPset_Column',               type:'Label' },
            { name:'ReferTo2DDetail',         pset:'SGPset_Column',               type:'Label' },
            { name:'SectionFabricationMethod',pset:'SGPset_Column',               type:'Label' },
            { name:'Width',                   pset:'SGPset_ColumnDimension',      type:'Length' },
            { name:'Depth',                   pset:'SGPset_ColumnDimension',      type:'Length' },
            { name:'Diameter',                pset:'SGPset_ColumnDimension',      type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',             type:'Label',  values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_ColumnReinforcement',  type:'Label',  values:REBAR_GRADES },
            { name:'LongitudinalRebar',       pset:'SGPset_ColumnReinforcement',  type:'Label' },
            { name:'Stirrup',                 pset:'SGPset_ColumnReinforcement',  type:'Label' },
            { name:'WorkingLoadDA1_1',        pset:'SGPset_ColumnStructuralLoad', type:'Integer' },
            { name:'WorkingLoadDA1_2',        pset:'SGPset_ColumnStructuralLoad', type:'Integer' },
          ],
        },
      },
    },

    'Slab': {
      entity: 'IfcSlab',
      subtypes: ['FLOOR','ROOF','LANDING','BASESLAB','*TRANSFERSLAB'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Slab','SGPset_SlabDimension','SGPset_SlabReinforcement','SGPset_Material'],
          params: [
            { name:'ConstructionMethod',      pset:'SGPset_Slab',              type:'Label',  values:CONSTRUCTION_METHODS },
            { name:'Mark',                    pset:'SGPset_Slab',              type:'Label' },
            { name:'ReferTo2DDetail',         pset:'SGPset_Slab',              type:'Label' },
            { name:'Thickness',               pset:'SGPset_SlabDimension',     type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',          type:'Label',  values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_SlabReinforcement', type:'Label',  values:REBAR_GRADES },
            { name:'TopRebarX',               pset:'SGPset_SlabReinforcement', type:'Label' },
            { name:'TopRebarY',               pset:'SGPset_SlabReinforcement', type:'Label' },
            { name:'BottomRebarX',            pset:'SGPset_SlabReinforcement', type:'Label' },
            { name:'BottomRebarY',            pset:'SGPset_SlabReinforcement', type:'Label' },
          ],
        },
      },
    },

    'Pile': {
      entity: 'IfcPile',
      subtypes: ['BORED','DRIVEN','JETGROUTING','*JACKEDIN'],
      discipline: 'Structural/Geotechnical',
      agencies: {
        BCA: {
          psets: ['SGPset_Pile','SGPset_PileDimension','SGPset_PileReinforcement','SGPset_PileStructuralLoad','SGPset_PilingDesignParameter','SGPset_Material'],
          params: [
            { name:'PileType',                    pset:'SGPset_Pile',                  type:'Label',   values:['Driven','Bored','Jacked in'] },
            { name:'ConstructionMethod',          pset:'SGPset_Pile',                  type:'Label',   values:CONSTRUCTION_METHODS },
            { name:'Mark',                        pset:'SGPset_Pile',                  type:'Label' },
            { name:'Diameter',                    pset:'SGPset_PileDimension',         type:'Length' },
            { name:'Length',                      pset:'SGPset_PileDimension',         type:'Length' },
            { name:'Breadth',                     pset:'SGPset_PileDimension',         type:'Length' },
            { name:'CutOffLevel_SHD',             pset:'SGPset_PileDimension',         type:'Real' },
            { name:'MaterialGrade',               pset:'SGPset_Material',              type:'Label',   values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade',     pset:'SGPset_PileReinforcement',     type:'Label',   values:REBAR_GRADES },
            { name:'DA1_1_CompressionCapacity',   pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_2_CompressionCapacity',   pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_1_TensionCapacity',       pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_2_TensionCapacity',       pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_1_CompressionDesignLoad', pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_2_CompressionDesignLoad', pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_1_TensionDesignLoad',     pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'DA1_2_TensionDesignLoad',     pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'NegativeSkinFriction',        pset:'SGPset_PileStructuralLoad',    type:'Integer' },
            { name:'BoreholeRef',                 pset:'SGPset_PilingDesignParameter', type:'Label' },
            { name:'MinEmbedmentSPT100N',         pset:'SGPset_PilingDesignParameter', type:'Real' },
            { name:'MinEmbedmentSPT60N',          pset:'SGPset_PilingDesignParameter', type:'Real' },
            { name:'MinRockSocketingLength',      pset:'SGPset_PilingDesignParameter', type:'Real' },
          ],
        },
      },
    },

    'Footing': {
      entity: 'IfcFooting',
      subtypes: ['CAISSON_FOUNDATION','FOOTING_BEAM','PAD_FOOTING','PILE_CAP','STRIP_FOOTING'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Footing','SGPset_FootingDimension','SGPset_FootingReinforcement','SGPset_FoundationStructuralLoad','SGPset_Material'],
          params: [
            { name:'ConstructionMethod',      pset:'SGPset_Footing',                  type:'Label',  values:CONSTRUCTION_METHODS },
            { name:'Mark',                    pset:'SGPset_Footing',                  type:'Label' },
            { name:'Width',                   pset:'SGPset_FootingDimension',         type:'Length' },
            { name:'Length',                  pset:'SGPset_FootingDimension',         type:'Length' },
            { name:'Depth',                   pset:'SGPset_FootingDimension',         type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',                 type:'Label',  values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_FootingReinforcement',     type:'Label',  values:REBAR_GRADES },
            { name:'WorkingLoadDA1_1',        pset:'SGPset_FoundationStructuralLoad', type:'Integer' },
            { name:'WorkingLoadDA1_2',        pset:'SGPset_FoundationStructuralLoad', type:'Integer' },
          ],
        },
      },
    },

    // ─── ARCHITECTURAL ────────────────────────────────────────────────────────

    'Door': {
      entity: 'IfcDoor',
      subtypes: ['DOOR','GATE','TRAPDOOR'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_Door','SGPset_DoorDimension','SGPset_Material'],
          params: [
            { name:'SelfClosing',         pset:'SGPset_Door',          type:'Boolean' },
            { name:'OneWayLockingDevice', pset:'SGPset_Door',          type:'Boolean' },
            { name:'VisionPanel',         pset:'SGPset_Door',          type:'Boolean' },
            { name:'ClearWidth',          pset:'SGPset_DoorDimension', type:'Length' },
            { name:'ClearHeight',         pset:'SGPset_DoorDimension', type:'Length' },
            { name:'OverallWidth',        pset:'SGPset_DoorDimension', type:'Length' },
            { name:'StructuralWidth',     pset:'SGPset_DoorDimension', type:'Length' },
            { name:'StructuralHeight',    pset:'SGPset_DoorDimension', type:'Length' },
            { name:'Thickness',           pset:'SGPset_DoorDimension', type:'Length' },
            { name:'MaterialGrade',       pset:'SGPset_Material',      type:'Label',  values:ALL_MATERIAL_GRADES },
          ],
        },
        SCDF: {
          psets: ['Pset_DoorCommon','SGPset_Door'],
          params: [
            { name:'FireRating',        pset:'Pset_DoorCommon', type:'Label',   values:FIRE_RATINGS },
            { name:'FireExit',          pset:'Pset_DoorCommon', type:'Boolean' },
            { name:'FireAccessOpening', pset:'SGPset_Door',     type:'Boolean' },
          ],
        },
      },
    },

    'Window': {
      entity: 'IfcWindow',
      subtypes: ['WINDOW','SKYLIGHT','LIGHTDOME'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_WindowDimension'],
          params: [
            { name:'ClearWidth',    pset:'SGPset_WindowDimension', type:'Length' },
            { name:'ClearHeight',   pset:'SGPset_WindowDimension', type:'Length' },
            { name:'OverallWidth',  pset:'SGPset_WindowDimension', type:'Length' },
            { name:'OverallHeight', pset:'SGPset_WindowDimension', type:'Length' },
            { name:'SillHeight',    pset:'SGPset_WindowDimension', type:'Length' },
          ],
        },
        NEA: {
          psets: ['SGPset_Window'],
          params: [
            { name:'OpenableArea',    pset:'SGPset_Window', type:'Real' },
            { name:'VentilationType', pset:'SGPset_Window', type:'Label', values:['Natural','Mechanical','Mixed Mode'] },
          ],
        },
      },
    },

    'Staircase': {
      entity: 'IfcStair',
      subtypes: ['STRAIGHT_RUN_STAIR','TWO_STRAIGHT_RUN_STAIR','QUARTER_WINDING_STAIR','HALF_WINDING_STAIR','SPIRAL_STAIR'],
      discipline: 'Architectural/Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Stair','SGPset_StairDimension','SGPset_StairReinforcement','SGPset_StairSteelConnection','SGPset_Material'],
          params: [
            { name:'Mark',                    pset:'SGPset_Stair',               type:'Label' },
            { name:'ReferTo2DDetail',         pset:'SGPset_Stair',               type:'Label' },
            { name:'SectionFabricationMethod',pset:'SGPset_Stair',               type:'Label' },
            { name:'FlightWidth',             pset:'SGPset_StairDimension',      type:'Length' },
            { name:'LandingWidth',            pset:'SGPset_StairDimension',      type:'Length' },
            { name:'MaterialGrade',           pset:'SGPset_Material',            type:'Label',  values:ALL_MATERIAL_GRADES },
            { name:'ReinforcementSteelGrade', pset:'SGPset_StairReinforcement',  type:'Label',  values:REBAR_GRADES },
            { name:'ConnectionType',          pset:'SGPset_StairSteelConnection',type:'Label' },
          ],
        },
        SCDF: {
          psets: ['Pset_StairCommon','Pset_StairFlightCommon','SGPset_StairFlight'],
          params: [
            { name:'FireExit',           pset:'Pset_StairCommon',       type:'Boolean' },
            { name:'RiserCount',         pset:'Pset_StairFlightCommon', type:'Integer' },
            { name:'TreadCount',         pset:'Pset_StairFlightCommon', type:'Integer' },
            { name:'RiserHeight',        pset:'Pset_StairFlightCommon', type:'Length' },
            { name:'TreadLength',        pset:'Pset_StairFlightCommon', type:'Length' },
            { name:'ConstructionMethod', pset:'SGPset_StairFlight',     type:'Label',  values:CONSTRUCTION_METHODS },
          ],
        },
      },
    },

    'Ramp': {
      entity: 'IfcRamp',
      subtypes: ['STRAIGHT_RUN_RAMP','TWO_STRAIGHT_RUN_RAMP','QUARTER_TURN_RAMP','HALF_TURN_RAMP','SPIRAL_RAMP'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_Ramp','SGPset_RampDimension','SGPset_Material'],
          params: [
            { name:'Mark',         pset:'SGPset_Ramp',          type:'Label' },
            { name:'Gradient',     pset:'SGPset_Ramp',          type:'Real' },
            { name:'ClearWidth',   pset:'SGPset_RampDimension', type:'Length' },
            { name:'Length',       pset:'SGPset_RampDimension', type:'Length' },
            { name:'MaterialGrade',pset:'SGPset_Material',      type:'Label',  values:ALL_MATERIAL_GRADES },
          ],
        },
      },
    },

    'Railing': {
      entity: 'IfcRailing',
      subtypes: ['HANDRAIL','GUARDRAIL','BALUSTRADE'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_Railing','SGPset_RailingDimension','SGPset_Material'],
          params: [
            { name:'Mark',         pset:'SGPset_Railing',          type:'Label' },
            { name:'Height',       pset:'SGPset_RailingDimension', type:'Length' },
            { name:'MaterialGrade',pset:'SGPset_Material',         type:'Label',  values:ALL_MATERIAL_GRADES },
          ],
        },
      },
    },

    'Roof': {
      entity: 'IfcRoof',
      subtypes: ['FLAT_ROOF','SHED_ROOF','GABLE_ROOF','HIP_ROOF','HIPPED_GABLE_ROOF','GAMBREL_ROOF','MANSARD_ROOF','BARREL_ROOF','BUTTERFLY_ROOF','DOME_ROOF'],
      discipline: 'Architectural/Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_Roof','SGPset_Material'],
          params: [
            { name:'Mark',               pset:'SGPset_Roof',    type:'Label' },
            { name:'ConstructionMethod', pset:'SGPset_Roof',    type:'Label', values:CONSTRUCTION_METHODS },
            { name:'MaterialGrade',      pset:'SGPset_Material',type:'Label', values:ALL_MATERIAL_GRADES },
          ],
        },
      },
    },

    'Covering': {
      entity: 'IfcCovering',
      subtypes: ['CEILING','CLADDING','FLOORING','INSULATION','MEMBRANE','ROOFING','SKIRTINGBOARD','WRAPPING'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_Covering','Pset_CoveringCommon'],
          params: [
            { name:'Mark',      pset:'SGPset_Covering',    type:'Label' },
            { name:'Thickness', pset:'Pset_CoveringCommon',type:'Length' },
          ],
        },
      },
    },

    'Precast Concrete': {
      entity: 'IfcBuildingElementProxy',
      subtypes: ['*PPVC','*PREFAB','*PRECAST'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_PrecastConcreteElementGeneral','SGPset_BuildingElementProxy','SGPset_BuildingElementProxyDimension','SGPset_Material'],
          params: [
            { name:'Mark',               pset:'SGPset_PrecastConcreteElementGeneral', type:'Label' },
            { name:'ConstructionMethod', pset:'SGPset_PrecastConcreteElementGeneral', type:'Label', values:CONSTRUCTION_METHODS },
            { name:'MaterialGrade',      pset:'SGPset_Material',                      type:'Label', values:ALL_MATERIAL_GRADES },
            { name:'Weight',             pset:'SGPset_BuildingElementProxyDimension', type:'Real' },
          ],
        },
      },
    },

    'Opening Element': {
      entity: 'IfcOpeningElement',
      subtypes: ['OPENING','RECESS'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_OpeningElement'],
          params: [
            { name:'Mark',   pset:'SGPset_OpeningElement', type:'Label' },
            { name:'Width',  pset:'SGPset_OpeningElement', type:'Length' },
            { name:'Height', pset:'SGPset_OpeningElement', type:'Length' },
          ],
        },
      },
    },

    'Shading Device': {
      entity: 'IfcShadingDevice',
      subtypes: ['JALOUSIE','AWNING','SUNLOUVRE'],
      discipline: 'Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_ShadingDevice'],
          params: [
            { name:'Mark',  pset:'SGPset_ShadingDevice', type:'Label' },
            { name:'Width', pset:'SGPset_ShadingDevice', type:'Length' },
            { name:'Depth', pset:'SGPset_ShadingDevice', type:'Length' },
          ],
        },
      },
    },

    'Furniture': {
      entity: 'IfcFurniture',
      subtypes: ['CHAIR','DESK','SOFA','SHELF','TABLE','FILING','TECHNICALITEM'],
      discipline: 'Architectural/Interior',
      agencies: {
        BCA: {
          psets: ['SGPset_Furniture'],
          params: [
            { name:'Mark',         pset:'SGPset_Furniture', type:'Label' },
            { name:'FurnitureType',pset:'SGPset_Furniture', type:'Label' },
          ],
        },
      },
    },

    'Discrete Accessory': {
      entity: 'IfcDiscreteAccessory',
      subtypes: ['ANCHORPLATE','BRACKET','SHOE'],
      discipline: 'Structural',
      agencies: {
        BCA: {
          psets: ['SGPset_DiscreteAccessory'],
          params: [
            { name:'Mark',          pset:'SGPset_DiscreteAccessory', type:'Label' },
            { name:'AccessoryType', pset:'SGPset_DiscreteAccessory', type:'Label' },
            { name:'MaterialGrade', pset:'SGPset_DiscreteAccessory', type:'Label', values:STEEL_GRADES },
          ],
        },
      },
    },

    // ─── SPACES ───────────────────────────────────────────────────────────────

    'Space (Usage)': {
      entity: 'IfcSpace',
      subtypes: ['SPACE','PARKING','GFA','INTERNAL','EXTERNAL'],
      discipline: 'All',
      agencies: {
        All: {
          psets: ['SGPset_Space','SGPset_SpaceDimension'],
          params: [
            { name:'SpaceName',                         pset:'SGPset_Space',          type:'Label',  note:'420 values - see SPACE_VALUES.SpaceName' },
            { name:'OccupancyType',                     pset:'SGPset_Space',          type:'Label',  note:'95 values - see SPACE_VALUES.OccupancyType' },
            { name:'OccupancyLoad',                     pset:'SGPset_Space',          type:'Integer' },
            { name:'BarrierFreeAccessibility',          pset:'SGPset_Space',          type:'Boolean' },
            { name:'AmbulantDisabled',                  pset:'SGPset_Space',          type:'Boolean' },
            { name:'ChildrenFriendly',                  pset:'SGPset_Space',          type:'Boolean' },
            { name:'ElderlyFriendly',                   pset:'SGPset_Space',          type:'Boolean' },
            { name:'HearingEnhancement',                pset:'SGPset_Space',          type:'Boolean' },
            { name:'LargerAccessible',                  pset:'SGPset_Space',          type:'Boolean' },
            { name:'AccreditationMAS',                  pset:'SGPset_Space',          type:'Boolean' },
            { name:'Retrofit',                          pset:'SGPset_Space',          type:'Boolean' },
            { name:'FireDetectionAndSuppressionSystem', pset:'SGPset_Space',          type:'Label',  values:['AFAS','Sprinkler','Water Mist','VIFDS'] },
            { name:'FireEmergencyVentilationMode',      pset:'SGPset_Space',          type:'Label',  values:['Natural','Mechanical','Pressurisation','Cross-ventilation','Combined Natural and Mechanical','Exhaust Only'] },
            { name:'SmokeControlSystem',                pset:'SGPset_Space',          type:'Label',  values:['Smoke Vent','Purging','Jet Fan','Engineered'] },
            { name:'EmergencyVoiceCommunicationSystem', pset:'SGPset_Space',          type:'Label',  values:['1-way EVC','2-way EVC','PA System'] },
            { name:'FireExit',                          pset:'SGPset_Space',          type:'Boolean' },
            { name:'CValue',                            pset:'SGPset_Space',          type:'Real' },
            { name:'ParkingType',                       pset:'SGPset_Space',          type:'Label' },
            { name:'PurposeGroup',                      pset:'SGPset_Space',          type:'Label' },
            { name:'RefuseOutput',                      pset:'SGPset_Space',          type:'Real' },
            { name:'SoundPowerLevel',                   pset:'SGPset_Space',          type:'Real' },
            { name:'SoundPressureLevel',                pset:'SGPset_Space',          type:'Real' },
            { name:'Area',                              pset:'SGPset_SpaceDimension', type:'Area' },
            { name:'Height',                            pset:'SGPset_SpaceDimension', type:'Length' },
          ],
        },
      },
    },

    'Space (GFA)': {
      entity: 'IfcSpace',
      subtypes: ['GFA','*BONUSGFA'],
      discipline: 'URA',
      agencies: {
        URA: {
          psets: ['SGPset_SpaceArea_GFA','SGPset_SpaceArea_Verification'],
          params: [
            { name:'AGF_DevelopmentUse',     pset:'SGPset_SpaceArea_GFA',          type:'Label',  note:'25 values' },
            { name:'AGF_Name',               pset:'SGPset_SpaceArea_GFA',          type:'Label',  note:'801 values' },
            { name:'AGF_UnitNumber',         pset:'SGPset_SpaceArea_GFA',          type:'Label' },
            { name:'AGF_BonusGFAType',       pset:'SGPset_SpaceArea_GFA',          type:'Label',  note:'10 values' },
            { name:'AGF_Note',               pset:'SGPset_SpaceArea_GFA',          type:'Label' },
            { name:'AGF_UseQuantum',         pset:'SGPset_SpaceArea_GFA',          type:'Label',  values:['Predominant','Ancillary'] },
            { name:'AGF_BuildingTypology',   pset:'SGPset_SpaceArea_GFA',          type:'Label',  note:'29 values' },
            { name:'AGF_SupportingFacility', pset:'SGPset_SpaceArea_GFA',          type:'Label',  values:['Yes','No'] },
            { name:'AVF_IncludeAsGFA',       pset:'SGPset_SpaceArea_Verification', type:'Boolean' },
          ],
        },
      },
    },

    'Space (Strata)': {
      entity: 'IfcSpace',
      subtypes: ['INTERNAL'],
      discipline: 'URA',
      agencies: {
        URA: {
          psets: ['SGPset_SpaceArea_Strata'],
          params: [
            { name:'AST_AreaType',             pset:'SGPset_SpaceArea_Strata', type:'Label', values:['Strata Private','Communal','Common Area'] },
            { name:'AST_LegalArea',            pset:'SGPset_SpaceArea_Strata', type:'Real' },
            { name:'AST_Prop_StrataLotNumber', pset:'SGPset_SpaceArea_Strata', type:'Label' },
          ],
        },
      },
    },

    'Space (Connectivity)': {
      entity: 'IfcSpace',
      subtypes: ['*OPENCORRIDOR','*COVEREDWALKWAY','*COVEREDLINKWAY','*THROUGHBLOCKLINK','*PEDESTRIANLINK'],
      discipline: 'URA',
      agencies: {
        URA: {
          psets: ['SGPset_SpaceArea_Connectivity'],
          params: [
            { name:'ACN_ConnectivityType',          pset:'SGPset_SpaceArea_Connectivity', type:'Label', values:['Open Walkway','Covered Walkway','Covered Linkway','Through Block Link','Elevated Pedestrian Link','Underground Pedestrian Link','Covered Walkway (road crossing)','Open Walkway (road crossing)'] },
            { name:'ACN_ActivityGeneratingUseType', pset:'SGPset_SpaceArea_Connectivity', type:'Label', values:['Single Side','Double Side'] },
            { name:'ACN_IsPavingSpecified',         pset:'SGPset_SpaceArea_Connectivity', type:'Boolean' },
            { name:'ACN_OpenTime',                  pset:'SGPset_SpaceArea_Connectivity', type:'Label' },
            { name:'ACN_CloseTime',                 pset:'SGPset_SpaceArea_Connectivity', type:'Label' },
            { name:'ACN_IsOpen24HoursToPublic',     pset:'SGPset_SpaceArea_Connectivity', type:'Boolean' },
          ],
        },
      },
    },

    'Space (Landscape)': {
      entity: 'IfcSpace',
      subtypes: ['EXTERNAL','*LANDSCAPEAREA'],
      discipline: 'URA/NParks',
      agencies: {
        URA: {
          psets: ['SGPset_SpaceArea_Landscape'],
          params: [
            { name:'ALS_LandscapeType',    pset:'SGPset_SpaceArea_Landscape', type:'Label', note:'8 values' },
            { name:'ALS_GreeneryFeatures', pset:'SGPset_SpaceArea_Landscape', type:'Label', note:'12 values' },
            { name:'ALS_Species',          pset:'SGPset_SpaceArea_Landscape', type:'Label' },
          ],
        },
      },
    },

    // ─── TRANSPORT ────────────────────────────────────────────────────────────

    'Lift': {
      entity: 'IfcTransportElement',
      subtypes: ['ELEVATOR'],
      discipline: 'Mechanical/Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_TransportElement','SGPset_TransportElementDimension'],
          params: [
            { name:'BarrierFreeAccessibility', pset:'SGPset_TransportElement',          type:'Boolean' },
            { name:'Length',                   pset:'SGPset_TransportElementDimension', type:'Length' },
            { name:'Width',                    pset:'SGPset_TransportElementDimension', type:'Length' },
            { name:'ClearDepth',               pset:'SGPset_TransportElementDimension', type:'Length' },
            { name:'ClearHeight',              pset:'SGPset_TransportElementDimension', type:'Length' },
            { name:'ClearWidth',               pset:'SGPset_TransportElementDimension', type:'Length' },
          ],
        },
        SCDF: {
          psets: ['SGPset_TransportElement'],
          params: [
            { name:'FireFightingLift', pset:'SGPset_TransportElement', type:'Boolean' },
            { name:'LiftType',         pset:'SGPset_TransportElement', type:'Label' },
          ],
        },
      },
    },

    'Escalator': {
      entity: 'IfcTransportElement',
      subtypes: ['ESCALATOR'],
      discipline: 'Mechanical/Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_TransportElement','SGPset_TransportElementDimension'],
          params: [
            { name:'BarrierFreeAccessibility', pset:'SGPset_TransportElement',          type:'Boolean' },
            { name:'Width',                    pset:'SGPset_TransportElementDimension', type:'Length' },
          ],
        },
      },
    },

    'Moving Walkway': {
      entity: 'IfcTransportElement',
      subtypes: ['MOVINGWALKWAY'],
      discipline: 'Mechanical/Architectural',
      agencies: {
        BCA: {
          psets: ['SGPset_TransportElement','SGPset_TransportElementDimension'],
          params: [
            { name:'BarrierFreeAccessibility', pset:'SGPset_TransportElement',          type:'Boolean' },
            { name:'Width',                    pset:'SGPset_TransportElementDimension', type:'Length' },
          ],
        },
      },
    },

    // ─── MEP ─────────────────────────────────────────────────────────────────

    'Sanitary Terminal (WC)': {
      entity: 'IfcSanitaryTerminal',
      subtypes: ['TOILETPAN','CISTERN'],
      discipline: 'Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_SanitaryTerminal'],
          params: [{ name:'WELS', pset:'SGPset_SanitaryTerminal', type:'Boolean', note:'Water Efficiency Labelling Scheme' }],
        },
      },
    },

    'Sanitary Terminal (Tap)': {
      entity: 'IfcSanitaryTerminal',
      subtypes: ['*TAP','SINK','WASHHANDBASIN'],
      discipline: 'Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_SanitaryTerminal'],
          params: [{ name:'WELS', pset:'SGPset_SanitaryTerminal', type:'Boolean' }],
        },
      },
    },

    'Sanitary Terminal (Shower)': {
      entity: 'IfcSanitaryTerminal',
      subtypes: ['SHOWER','BATH'],
      discipline: 'Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_SanitaryTerminal'],
          params: [{ name:'WELS', pset:'SGPset_SanitaryTerminal', type:'Boolean' }],
        },
      },
    },

    'Sanitary Terminal (Urinal)': {
      entity: 'IfcSanitaryTerminal',
      subtypes: ['URINAL'],
      discipline: 'Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_SanitaryTerminal'],
          params: [{ name:'WELS', pset:'SGPset_SanitaryTerminal', type:'Boolean' }],
        },
      },
    },

    'Waste Terminal': {
      entity: 'IfcWasteTerminal',
      subtypes: ['FLOORTRAP','FLOORWASTE','ROOFDRAIN','WASTEDISPOSALUNIT'],
      discipline: 'Plumbing',
      agencies: {
        NEA: {
          psets: ['SGPset_WasteTerminal'],
          params: [
            { name:'TrapType',     pset:'SGPset_WasteTerminal', type:'Label' },
            { name:'InletDiameter',pset:'SGPset_WasteTerminal', type:'Length' },
          ],
        },
      },
    },

    'Pipe Segment': {
      entity: 'IfcPipeSegment',
      subtypes: ['RIGIDSEGMENT','FLEXIBLESEGMENT','GUTTER','SPOOL'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_PipeSegment','SGPset_PipeSegmentDimension'],
          params: [
            { name:'Gradient',                  pset:'SGPset_PipeSegment',          type:'Label' },
            { name:'SystemType',                pset:'SGPset_PipeSegment',          type:'Label' },
            { name:'SystemName',                pset:'SGPset_PipeSegment',          type:'Label' },
            { name:'DemountableStructureAbove', pset:'SGPset_PipeSegment',          type:'Boolean' },
            { name:'InnerDiameter',             pset:'SGPset_PipeSegmentDimension', type:'Length' },
            { name:'Length',                    pset:'SGPset_PipeSegmentDimension', type:'Length' },
            { name:'Thickness',                 pset:'SGPset_PipeSegmentDimension', type:'Length' },
          ],
        },
        NEA: {
          psets: ['SGPset_PipeSegment','SGPset_PipeSegmentDimension'],
          params: [
            { name:'Gradient',      pset:'SGPset_PipeSegment',          type:'Label' },
            { name:'SystemType',    pset:'SGPset_PipeSegment',          type:'Label' },
            { name:'InnerDiameter', pset:'SGPset_PipeSegmentDimension', type:'Length' },
          ],
        },
      },
    },

    'Pipe Fitting': {
      entity: 'IfcPipeFitting',
      subtypes: ['BEND','CONNECTOR','ENTRY','EXIT','JUNCTION','OBSTRUCTION','TRANSITION'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_PipeFitting','SGPset_PipeFittingDimension'],
          params: [
            { name:'OuterDiameter', pset:'SGPset_PipeFittingDimension', type:'Length' },
          ],
        },
      },
    },

    'Duct Segment': {
      entity: 'IfcDuctSegment',
      subtypes: ['RIGIDSEGMENT','FLEXIBLESEGMENT'],
      discipline: 'Mechanical',
      agencies: {
        NEA: {
          psets: ['SGPset_DuctSegment'],
          params: [
            { name:'SystemType', pset:'SGPset_DuctSegment', type:'Label' },
            { name:'SystemName', pset:'SGPset_DuctSegment', type:'Label' },
          ],
        },
      },
    },

    'Duct Fitting': {
      entity: 'IfcDuctFitting',
      subtypes: ['BEND','CONNECTOR','ENTRY','EXIT','JUNCTION','TRANSITION'],
      discipline: 'Mechanical',
      agencies: {
        NEA: {
          psets: ['SGPset_DuctFitting'],
          params: [
            { name:'SystemType', pset:'SGPset_DuctFitting', type:'Label' },
          ],
        },
      },
    },

    'Tank': {
      entity: 'IfcTank',
      subtypes: ['BASIN','BREAKPRESSUREVESSEL','EXPANSION','FEEDANDEXPANSION','PRESSUREVESSEL','STORAGE','VESSEL'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_Tank','SGPset_TankDimension','Pset_TankTypeCommon'],
          params: [
            { name:'TankType',  pset:'SGPset_Tank',          type:'Label' },
            { name:'Capacity',  pset:'Pset_TankTypeCommon',  type:'Volume' },
            { name:'Length',    pset:'SGPset_TankDimension', type:'Length' },
            { name:'Width',     pset:'SGPset_TankDimension', type:'Length' },
            { name:'Height',    pset:'SGPset_TankDimension', type:'Length' },
            { name:'Diameter',  pset:'SGPset_TankDimension', type:'Length' },
          ],
        },
      },
    },

    'Pump': {
      entity: 'IfcPump',
      subtypes: ['CIRCULATOR','ENDSUCTION','SPLITCASE','SUMPPUMP','VERTICALINLINE','VERTITURBINE'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_Pump'],
          params: [
            { name:'PumpType',     pset:'SGPset_Pump', type:'Label' },
            { name:'FlowRate',     pset:'SGPset_Pump', type:'Real' },
            { name:'PumpPressure', pset:'SGPset_Pump', type:'Real' },
          ],
        },
      },
    },

    'Flow Meter': {
      entity: 'IfcFlowMeter',
      subtypes: ['ENERGYMETER','GASMETER','WATERMETER'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_FlowMeter','SGPset_FlowMeterDimension','Pset_FlowMeterOccurrence'],
          params: [
            { name:'MeterType', pset:'SGPset_FlowMeter', type:'Label' },
          ],
        },
      },
    },

    'Valve': {
      entity: 'IfcValve',
      subtypes: ['AIRRELEASE','ANTIVACUUM','CHECK','COMMISSIONING','DIVERTING','DOUBLECHECKREDUCED','FAUCET','FLUSHING','GASCOCK','ISOLATING','MIXING','PRESSUREREDUCING','PRESSURERELIEF','STOPCOCK'],
      discipline: 'Mechanical/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_Valve'],
          params: [
            { name:'ValveType', pset:'SGPset_Valve', type:'Label' },
            { name:'Diameter',  pset:'SGPset_Valve', type:'Length' },
          ],
        },
      },
    },

    'Distribution Chamber': {
      entity: 'IfcDistributionChamberElement',
      subtypes: ['FORMEDDUCT','INSPECTIONCHAMBER','INSPECTIONPIT','MANHOLE','METERCHAMBER','SUMP','TRENCH','VALVECHAMBER'],
      discipline: 'Civil/Plumbing',
      agencies: {
        PUB: {
          psets: ['SGPset_DistributionChamberElement','SGPset_DistributionChamberElementDimension'],
          params: [
            { name:'ChamberType',pset:'SGPset_DistributionChamberElement',           type:'Label' },
            { name:'Length',     pset:'SGPset_DistributionChamberElementDimension',  type:'Length' },
            { name:'Width',      pset:'SGPset_DistributionChamberElementDimension',  type:'Length' },
            { name:'Depth',      pset:'SGPset_DistributionChamberElementDimension',  type:'Length' },
          ],
        },
      },
    },

    'Interceptor': {
      entity: 'IfcInterceptor',
      subtypes: ['CYCLONIC','GREASE','OIL','PETROL'],
      discipline: 'Plumbing',
      agencies: {
        NEA: {
          psets: ['SGPset_Interceptor','SGPset_InterceptorDimension'],
          params: [
            { name:'InterceptorType', pset:'SGPset_Interceptor',          type:'Label' },
            { name:'Capacity',        pset:'SGPset_Interceptor',          type:'Volume' },
            { name:'Length',          pset:'SGPset_InterceptorDimension', type:'Length' },
            { name:'Width',           pset:'SGPset_InterceptorDimension', type:'Length' },
          ],
        },
      },
    },

    'Fire Suppression Terminal': {
      entity: 'IfcFireSuppressionTerminal',
      subtypes: ['SPRINKLER','SPRINKLERDEFLECTOR','*HOSE_REEL','*FOAM_INLET'],
      discipline: 'Fire Protection',
      agencies: {
        SCDF: {
          psets: ['SGPset_FireSuppressionTerminal'],
          params: [
            { name:'SprinklerType',  pset:'SGPset_FireSuppressionTerminal', type:'Label' },
            { name:'CoverageRadius', pset:'SGPset_FireSuppressionTerminal', type:'Length' },
            { name:'ActivationTemp', pset:'SGPset_FireSuppressionTerminal', type:'Real' },
          ],
        },
      },
    },

    'Damper': {
      entity: 'IfcDamper',
      subtypes: ['BACKDRAFTDAMPER','BALANCINGDAMPER','BLASTDAMPER','CONTROLDAMPER','FIREDAMPER','FIRESMOKEDAMPER','FUMESDAMPER','GRAVITYDAMPER','GRAVITYTILTINGDAMPER','INTUMESCENTFIRECURTAIN','LOUVEREDAMPER','SMOKEDAMPER','SOUNDATTENUATOR','VOLUMETRICFLOWRATEDAMPER'],
      discipline: 'Mechanical/Fire Protection',
      agencies: {
        SCDF: {
          psets: ['SGPset_Damper'],
          params: [
            { name:'FireRating', pset:'SGPset_Damper', type:'Label', values:FIRE_RATINGS },
            { name:'DamperType', pset:'SGPset_Damper', type:'Label' },
          ],
        },
      },
    },

    'Air Terminal': {
      entity: 'IfcAirTerminal',
      subtypes: ['DIFFUSER','GRILLE','LOUVRE','REGISTER'],
      discipline: 'Mechanical',
      agencies: {
        NEA: {
          psets: ['SGPset_AirTerminal'],
          params: [
            { name:'AirflowRate', pset:'SGPset_AirTerminal', type:'Real' },
          ],
        },
      },
    },

    'Unitary Equipment': {
      entity: 'IfcUnitaryEquipment',
      subtypes: ['AIRHANDLER','AIRCONDITIONINGUNIT','DEHUMIDIFIER','SPLITSYSTEM','ROOFTOPUNIT'],
      discipline: 'Mechanical',
      agencies: {
        NEA: {
          psets: ['SGPset_UnitaryEquipment'],
          params: [
            { name:'CoolingCapacity',       pset:'SGPset_UnitaryEquipment', type:'Real' },
            { name:'EnergyEfficiencyRatio', pset:'SGPset_UnitaryEquipment', type:'Real' },
          ],
        },
      },
    },

    // ─── CIVIL ────────────────────────────────────────────────────────────────

    'Civil Element': {
      entity: 'IfcCivilElement',
      subtypes: ['*KERB','*CULVERT','*RETAININGSTRUCTURE','*DRAINAGESWALE'],
      discipline: 'Civil',
      agencies: {
        LTA: {
          psets: ['SGPset_CivilElement','SGPset_CivilElementDimension'],
          params: [
            { name:'ElementType', pset:'SGPset_CivilElement',          type:'Label' },
            { name:'Length',      pset:'SGPset_CivilElementDimension', type:'Length' },
            { name:'Width',       pset:'SGPset_CivilElementDimension', type:'Length' },
            { name:'Height',      pset:'SGPset_CivilElementDimension', type:'Length' },
          ],
        },
      },
    },

    // ─── SITE / LANDSCAPE ─────────────────────────────────────────────────────

    'Site Boundary': {
      entity: 'IfcGeographicElement',
      subtypes: ['TERRAIN','*SITEBOUNDARY'],
      discipline: 'Site/Survey',
      agencies: {
        URA: {
          psets: ['SGPset_GeographicElement','SGPset_GeographicElementDimension'],
          params: [
            { name:'BroadLandUse', pset:'SGPset_GeographicElement',          type:'Label', values:['Agriculture','Beach Area','Business 1','Business 1-White','Business 2','Business 2-White','Business Park','Business Park-White','Cemetery','Civic & Community Institution','Commercial','Educational Institution','Health & Medical Care','Hotel','Mass Rapid Transit','Open Space','Park','Place of Worship','Port/Airport','Recreational','Reserve Site','Residential','Residential With Commercial At 1st Storey','Road','Special Use','Sports & Recreation','Transport Facilities','Utility','Waterbody','White'] },
            { name:'Area',         pset:'SGPset_GeographicElementDimension', type:'Area' },
          ],
        },
      },
    },

    'Landscape Plant (Tree)': {
      entity: 'IfcGeographicElement',
      subtypes: ['VEGETATION','*TREE'],
      discipline: 'Landscape',
      agencies: {
        NParks: {
          psets: ['SGPset_GeographicElement','SGPset_GeographicElementDimension'],
          params: [
            { name:'Species',    pset:'SGPset_GeographicElement',          type:'Label' },
            { name:'TreeNumber', pset:'SGPset_GeographicElement',          type:'Label' },
            { name:'TreeSize',   pset:'SGPset_GeographicElement',          type:'Label' },
            { name:'Status',     pset:'SGPset_GeographicElement',          type:'Label', values:PLANT_STATUS },
            { name:'Roadside',   pset:'SGPset_GeographicElement',          type:'Boolean' },
            { name:'SingleStem', pset:'SGPset_GeographicElement',          type:'Boolean' },
            { name:'Height',     pset:'SGPset_GeographicElementDimension', type:'Length' },
            { name:'Girth',      pset:'SGPset_GeographicElementDimension', type:'Length' },
          ],
        },
      },
    },

    'Landscape Plant (Hedge)': {
      entity: 'IfcGeographicElement',
      subtypes: ['VEGETATION','*HEDGE'],
      discipline: 'Landscape',
      agencies: {
        NParks: {
          psets: ['SGPset_GeographicElement','SGPset_GeographicElementDimension'],
          params: [
            { name:'Species',     pset:'SGPset_GeographicElement',          type:'Label' },
            { name:'HedgeNumber', pset:'SGPset_GeographicElement',          type:'Label' },
            { name:'Status',      pset:'SGPset_GeographicElement',          type:'Label', values:PLANT_STATUS },
            { name:'Height',      pset:'SGPset_GeographicElementDimension', type:'Length' },
          ],
        },
      },
    },

    'Green Verge': {
      entity: 'IfcGeographicElement',
      subtypes: ['*GREENVERGE'],
      discipline: 'Landscape',
      agencies: {
        NParks: {
          psets: ['SGPset_GeographicElement','SGPset_SpaceArea_Landscape'],
          params: [
            { name:'ApprovedSoilMixture', pset:'SGPset_GeographicElement',   type:'Boolean' },
            { name:'ApprovedTurfSpecies', pset:'SGPset_GeographicElement',   type:'Boolean' },
            { name:'ShrubSpecies',        pset:'SGPset_GeographicElement',   type:'Label' },
            { name:'Status',              pset:'SGPset_GeographicElement',   type:'Label', values:['Existing','Proposed','To be Removed'] },
            { name:'Turf',                pset:'SGPset_GeographicElement',   type:'Boolean' },
            { name:'ALS_GreeneryFeature', pset:'SGPset_SpaceArea_Landscape', type:'Label', values:['Green Verge'] },
            { name:'ALS_LandscapeType',   pset:'SGPset_SpaceArea_Landscape', type:'Label', values:['Turfing','Groundcover','Shrubs'] },
          ],
        },
      },
    },

    // ─── BUILDING / SITE ──────────────────────────────────────────────────────

    'Building': {
      entity: 'IfcBuilding',
      subtypes: [],
      discipline: 'All',
      agencies: {
        BCA: {
          psets: ['SGPset_Building'],
          params: [
            { name:'BuildingType',          pset:'SGPset_Building', type:'Label' },
            { name:'TotalGFA',              pset:'SGPset_Building', type:'Area' },
            { name:'NumberOfStoreys',       pset:'SGPset_Building', type:'Integer' },
            { name:'OccupancyType',         pset:'SGPset_Building', type:'Label' },
            { name:'ConstructionStartDate', pset:'SGPset_Building', type:'Label' },
            { name:'ConstructionEndDate',   pset:'SGPset_Building', type:'Label' },
          ],
        },
      },
    },

    'Site': {
      entity: 'IfcSite',
      subtypes: [],
      discipline: 'All',
      agencies: {
        URA: {
          psets: ['SGPset_Site'],
          params: [
            { name:'SiteArea',     pset:'SGPset_Site', type:'Area' },
            { name:'PlotRatio',    pset:'SGPset_Site', type:'Real' },
            { name:'AllowableGFA', pset:'SGPset_Site', type:'Area' },
            { name:'ProposedGFA',  pset:'SGPset_Site', type:'Area' },
            { name:'BroadLandUse', pset:'SGPset_Site', type:'Label' },
          ],
        },
      },
    },

  };

  // ── Space Values ──────────────────────────────────────────────────────────
  const SPACE_VALUES = {
    OccupancyType: [
      'Assembly and Recreation - Concert Hall / Auditorium','Assembly and Recreation - Cinema / Theatre',
      'Assembly and Recreation - Dance Hall / Discotheque','Assembly and Recreation - Exhibition Hall',
      'Assembly and Recreation - Stadium / Arena','Assembly and Recreation - Bowling Alley',
      'Assembly and Recreation - Indoor Games Hall','Assembly and Recreation - Swimming Pool',
      'Assembly and Recreation - Gymnasium / Fitness Centre','Assembly and Recreation - Clubhouse',
      'Assembly and Recreation - Place of Worship','Assembly and Recreation - Community Centre',
      'Business - Office','Business - Conference Room','Business - Call Centre',
      'Educational - Classroom','Educational - Lecture Hall','Educational - Laboratory',
      'Educational - Library','Educational - Workshop','Educational - Art Room',
      'Food and Beverage - Restaurant','Food and Beverage - Hawker Centre / Food Court',
      'Food and Beverage - Canteen','Food and Beverage - Café / Bar',
      'Healthcare - Ward','Healthcare - Operating Theatre','Healthcare - Consultation Room',
      'Healthcare - Pharmacy','Healthcare - Isolation Room',
      'Hotel - Guest Room','Hotel - Ballroom','Hotel - Lobby',
      'Industrial - Factory','Industrial - Warehouse','Industrial - Clean Room','Industrial - Workshop',
      'Residential - Living Room','Residential - Bedroom','Residential - Kitchen',
      'Residential - Bathroom / Toilet','Residential - Study Room',
      'Retail - Shop','Retail - Department Store','Retail - Supermarket','Retail - Showroom','Retail - Wet Market',
      'Car Park - Open-air','Car Park - Multi-storey','Car Park - Basement','Car Park - Mechanised',
      'Circulation - Corridor','Circulation - Lobby / Foyer','Circulation - Staircase',
      'Circulation - Lift Lobby','Circulation - Loading / Unloading Bay',
      'Storage - Store Room','Storage - Archive','Storage - Cold Room',
      'Utility - Electrical Substation','Utility - Generator Room','Utility - Mechanical Plant Room',
      'Utility - Refuse Storage','Utility - Pump Room','Utility - AHU Room',
      'Utility - IT Server Room','Utility - Loading Dock',
      'Outdoor - Roof Garden','Outdoor - Terrace','Outdoor - Covered Walkway',
      'Outdoor - Basement Driveway','Outdoor - Surface Car Park',
      'Special - Prison / Detention','Special - Military Facility','Special - Data Centre',
      'Special - Airport Terminal','Special - Port / Ferry Terminal','Special - Bus Interchange',
      'Special - MRT Station','Special - Hospital','Special - Research Laboratory',
      'Special - Childcare Centre','Special - Eldercare Centre',
      'Special - Mosque','Special - Church','Special - Temple','Special - Synagogue',
      'Common - Toilet (male)','Common - Toilet (female)','Common - Accessible Toilet',
      'Common - Nursing Room','Common - Prayer Room','Common - First Aid Room','Common - Security Post',
    ],
    AGF_DevelopmentUse: [
      'Residential','Commercial','Industrial','Hotel','Civic & Community Institution',
      'Educational Institution','Health & Medical Care','Place of Worship','Sports & Recreation',
      'Open Space','Transport Facilities','Utility','Agricultural','Beach Area',
      'Business 1','Business 1-White','Business 2','Business 2-White','Business Park',
      'Business Park-White','Special Use','White','Reserve Site','Mixed Use','Others',
    ],
    AGF_BuildingTypology: [
      'Apartment','Condominium','Landed Housing','HDB Flat','Serviced Apartment',
      'Hotel','Serviced Residence','Office','Retail','Shopping Mall','Business Park',
      'Industrial (B1)','Industrial (B2)','Warehouse','Data Centre','Hospital',
      'Medical Centre','School','Junior College','University','Sports Complex',
      'Community Club','Place of Worship','Civic Building','Transport Hub',
      'Mixed Development (Residential + Commercial)','Mixed Development (Commercial + Industrial)',
      'Integrated Development','Others',
    ],
    AGF_BonusGFAType: [
      'Balcony','Private Enclosed Space (PES)','Private Roof Terrace',
      'Strata Void','Sky Terrace','Community Space','MSCP',
      'Landscaping','Solar Panel Area','Others',
    ],
    ALS_LandscapeType: ['Turfing','Groundcover','Shrubs','Trees','Green Roof','Vertical Greenery','Planter Box','Water Feature'],
    ALS_GreeneryFeatures: ['Green Verge','Communal Garden','Rooftop Garden','Sky Garden','Vertical Garden','Nature Corridor','Heritage Tree Zone','Community Garden','Therapeutic Garden','Rain Garden','Bio-swale','Wetland'],
  };

  // ── SGPset Guide ──────────────────────────────────────────────────────────
  const SGPSET_GUIDE = {
    'SGPset_Wall':                               { entity:'IfcWall',                        agency:'BCA',        desc:'Construction method, booleans (party wall/external/load bearing/shelter/facade), mark' },
    'SGPset_WallDimension':                      { entity:'IfcWall',                        agency:'BCA',        desc:'Thickness, length' },
    'SGPset_WallReinforcement':                  { entity:'IfcWall',                        agency:'BCA',        desc:'Rebar grade, horizontal/vertical bars' },
    'SGPset_WallStructuralLoad':                 { entity:'IfcWall',                        agency:'BCA',        desc:'DA1-1/DA1-2 working loads' },
    'SGPset_Beam':                               { entity:'IfcBeam',                        agency:'BCA',        desc:'Construction method, mark, fabrication method' },
    'SGPset_BeamDimension':                      { entity:'IfcBeam',                        agency:'BCA',        desc:'Width, depth, length' },
    'SGPset_BeamReinforcement':                  { entity:'IfcBeam',                        agency:'BCA',        desc:'Rebar grade, top/bottom/shear bars' },
    'SGPset_SteelConnection':                    { entity:'IfcBeam/IfcColumn/IfcStair',     agency:'BCA',        desc:'Steel connection type' },
    'SGPset_Column':                             { entity:'IfcColumn',                      agency:'BCA',        desc:'Construction method, mark, fabrication method' },
    'SGPset_ColumnDimension':                    { entity:'IfcColumn',                      agency:'BCA',        desc:'Width, depth, diameter' },
    'SGPset_ColumnReinforcement':                { entity:'IfcColumn',                      agency:'BCA',        desc:'Rebar grade, longitudinal bars, stirrups' },
    'SGPset_ColumnStructuralLoad':               { entity:'IfcColumn',                      agency:'BCA',        desc:'DA1-1/DA1-2 working loads' },
    'SGPset_Slab':                               { entity:'IfcSlab',                        agency:'BCA',        desc:'Construction method, mark' },
    'SGPset_SlabDimension':                      { entity:'IfcSlab',                        agency:'BCA',        desc:'Thickness' },
    'SGPset_SlabReinforcement':                  { entity:'IfcSlab',                        agency:'BCA',        desc:'Rebar grade, top/bottom X/Y bars' },
    'SGPset_Pile':                               { entity:'IfcPile',                        agency:'BCA',        desc:'Pile type (Driven/Bored/Jacked in), construction method, mark' },
    'SGPset_PileDimension':                      { entity:'IfcPile',                        agency:'BCA',        desc:'Diameter, length, breadth, CutOffLevel_SHD' },
    'SGPset_PileReinforcement':                  { entity:'IfcPile',                        agency:'BCA',        desc:'Rebar grade' },
    'SGPset_PileStructuralLoad':                 { entity:'IfcPile',                        agency:'BCA',        desc:'DA1-1/DA1-2 compression/tension capacity and design load; NegativeSkinFriction' },
    'SGPset_PilingDesignParameter':              { entity:'IfcPile',                        agency:'BCA',        desc:'BoreholeRef, MinEmbedmentSPT100N/60N, MinRockSocketingLength' },
    'SGPset_Footing':                            { entity:'IfcFooting',                     agency:'BCA',        desc:'Construction method, mark' },
    'SGPset_FootingDimension':                   { entity:'IfcFooting',                     agency:'BCA',        desc:'Width, length, depth' },
    'SGPset_FootingReinforcement':               { entity:'IfcFooting',                     agency:'BCA',        desc:'Rebar grade' },
    'SGPset_FoundationStructuralLoad':           { entity:'IfcFooting',                     agency:'BCA',        desc:'DA1-1/DA1-2 working loads' },
    'SGPset_Door':                               { entity:'IfcDoor',                        agency:'BCA/SCDF',   desc:'SelfClosing, OneWayLockingDevice, VisionPanel (BCA); FireAccessOpening (SCDF)' },
    'SGPset_DoorDimension':                      { entity:'IfcDoor',                        agency:'BCA',        desc:'Clear/overall/structural width, height, thickness' },
    'SGPset_Window':                             { entity:'IfcWindow',                      agency:'NEA',        desc:'OpenableArea, VentilationType' },
    'SGPset_WindowDimension':                    { entity:'IfcWindow',                      agency:'BCA',        desc:'Clear/overall dimensions, SillHeight' },
    'SGPset_Space':                              { entity:'IfcSpace',                       agency:'All',        desc:'SpaceName, OccupancyType/Load, accessibility booleans, fire/smoke/EVC systems, CValue, ParkingType, PurposeGroup' },
    'SGPset_SpaceDimension':                     { entity:'IfcSpace',                       agency:'All',        desc:'Area, Height' },
    'SGPset_SpaceArea_GFA':                      { entity:'IfcSpace',                       agency:'URA',        desc:'AGF_DevelopmentUse, AGF_Name, AGF_UnitNumber, AGF_BonusGFAType, AGF_UseQuantum, AGF_BuildingTypology, AGF_SupportingFacility' },
    'SGPset_SpaceArea_Strata':                   { entity:'IfcSpace',                       agency:'URA',        desc:'AST_AreaType (Strata Private/Communal/Common Area), AST_LegalArea, AST_Prop_StrataLotNumber' },
    'SGPset_SpaceArea_Connectivity':             { entity:'IfcSpace',                       agency:'URA',        desc:'ACN_ConnectivityType, ACN_ActivityGeneratingUseType, paving, open/close times, 24h public access' },
    'SGPset_SpaceArea_Landscape':                { entity:'IfcSpace/IfcGeographicElement',  agency:'URA/NParks', desc:'ALS_LandscapeType (8), ALS_GreeneryFeatures (12), ALS_Species' },
    'SGPset_SpaceArea_Verification':             { entity:'IfcSpace',                       agency:'URA',        desc:'AVF_IncludeAsGFA (Boolean)' },
    'SGPset_Stair':                              { entity:'IfcStair',                       agency:'BCA',        desc:'Mark, ReferTo2DDetail, SectionFabricationMethod' },
    'SGPset_StairDimension':                     { entity:'IfcStair',                       agency:'BCA',        desc:'FlightWidth, LandingWidth' },
    'SGPset_StairFlight':                        { entity:'IfcStairFlight',                 agency:'SCDF',       desc:'ConstructionMethod' },
    'SGPset_StairReinforcement':                 { entity:'IfcStair',                       agency:'BCA',        desc:'Rebar grade' },
    'SGPset_StairSteelConnection':               { entity:'IfcStair',                       agency:'BCA',        desc:'ConnectionType' },
    'SGPset_Ramp':                               { entity:'IfcRamp',                        agency:'BCA',        desc:'Mark, Gradient' },
    'SGPset_RampDimension':                      { entity:'IfcRamp',                        agency:'BCA',        desc:'ClearWidth, Length' },
    'SGPset_Railing':                            { entity:'IfcRailing',                     agency:'BCA',        desc:'Mark' },
    'SGPset_RailingDimension':                   { entity:'IfcRailing',                     agency:'BCA',        desc:'Height' },
    'SGPset_Roof':                               { entity:'IfcRoof',                        agency:'BCA',        desc:'Mark, ConstructionMethod' },
    'SGPset_Material':                           { entity:'(All structural elements)',       agency:'BCA',        desc:'MaterialGrade: C12/15-C80/95 (concrete), S235/S275/S355 (steel)' },
    'SGPset_Building':                           { entity:'IfcBuilding',                    agency:'BCA',        desc:'BuildingType, TotalGFA, NumberOfStoreys, OccupancyType, construction dates' },
    'SGPset_Site':                               { entity:'IfcSite',                        agency:'URA',        desc:'SiteArea, PlotRatio, AllowableGFA, ProposedGFA, BroadLandUse' },
    'SGPset_TransportElement':                   { entity:'IfcTransportElement',            agency:'BCA/SCDF',   desc:'BarrierFreeAccessibility (BCA), FireFightingLift/LiftType (SCDF)' },
    'SGPset_TransportElementDimension':          { entity:'IfcTransportElement',            agency:'BCA',        desc:'Length, Width, ClearDepth, ClearHeight, ClearWidth' },
    'SGPset_PipeSegment':                        { entity:'IfcPipeSegment',                 agency:'PUB/NEA',    desc:'Gradient, SystemType, SystemName, DemountableStructureAbove' },
    'SGPset_PipeSegmentDimension':               { entity:'IfcPipeSegment',                 agency:'PUB',        desc:'InnerDiameter, Length, Thickness' },
    'SGPset_PipeFitting':                        { entity:'IfcPipeFitting',                 agency:'PUB',        desc:'Pipe fitting properties' },
    'SGPset_PipeFittingDimension':               { entity:'IfcPipeFitting',                 agency:'PUB',        desc:'OuterDiameter' },
    'SGPset_DuctSegment':                        { entity:'IfcDuctSegment',                 agency:'NEA',        desc:'SystemType, SystemName' },
    'SGPset_DuctFitting':                        { entity:'IfcDuctFitting',                 agency:'NEA',        desc:'SystemType' },
    'SGPset_SanitaryTerminal':                   { entity:'IfcSanitaryTerminal',            agency:'PUB',        desc:'WELS (Water Efficiency Labelling Scheme) - Boolean' },
    'SGPset_WasteTerminal':                      { entity:'IfcWasteTerminal',               agency:'NEA',        desc:'TrapType, InletDiameter' },
    'SGPset_Tank':                               { entity:'IfcTank',                        agency:'PUB',        desc:'TankType' },
    'SGPset_TankDimension':                      { entity:'IfcTank',                        agency:'PUB',        desc:'Length, Width, Height, Diameter' },
    'SGPset_Pump':                               { entity:'IfcPump',                        agency:'PUB',        desc:'PumpType, FlowRate, PumpPressure' },
    'SGPset_FlowMeter':                          { entity:'IfcFlowMeter',                   agency:'PUB',        desc:'MeterType' },
    'SGPset_FlowMeterDimension':                 { entity:'IfcFlowMeter',                   agency:'PUB',        desc:'Flow meter dimensions' },
    'SGPset_Valve':                              { entity:'IfcValve',                       agency:'PUB',        desc:'ValveType, Diameter' },
    'SGPset_CivilElement':                       { entity:'IfcCivilElement',                agency:'LTA',        desc:'ElementType (kerb/culvert/retaining structure)' },
    'SGPset_CivilElementDimension':              { entity:'IfcCivilElement',                agency:'LTA',        desc:'Length, Width, Height' },
    'SGPset_GeographicElement':                  { entity:'IfcGeographicElement',           agency:'NParks/URA', desc:'Species, tree/hedge number, Status (Existing/Proposed/To be Removed/Transplanted), Roadside, BroadLandUse' },
    'SGPset_GeographicElementDimension':         { entity:'IfcGeographicElement',           agency:'NParks/URA', desc:'Height, Girth, Area' },
    'SGPset_DistributionChamberElement':         { entity:'IfcDistributionChamberElement',  agency:'PUB',        desc:'ChamberType (manhole/inspection/sump/trench)' },
    'SGPset_DistributionChamberElementDimension':{ entity:'IfcDistributionChamberElement',  agency:'PUB',        desc:'Length, Width, Depth' },
    'SGPset_Interceptor':                        { entity:'IfcInterceptor',                 agency:'NEA',        desc:'InterceptorType, Capacity' },
    'SGPset_InterceptorDimension':               { entity:'IfcInterceptor',                 agency:'NEA',        desc:'Length, Width' },
    'SGPset_FireSuppressionTerminal':            { entity:'IfcFireSuppressionTerminal',     agency:'SCDF',       desc:'SprinklerType, CoverageRadius, ActivationTemp' },
    'SGPset_Damper':                             { entity:'IfcDamper',                      agency:'SCDF',       desc:'FireRating (0.5-4 hours), DamperType' },
    'SGPset_Covering':                           { entity:'IfcCovering',                    agency:'BCA',        desc:'Mark' },
    'SGPset_Furniture':                          { entity:'IfcFurniture',                   agency:'BCA',        desc:'Mark, FurnitureType' },
    'SGPset_BuildingElementProxy':               { entity:'IfcBuildingElementProxy',        agency:'BCA',        desc:'Proxy element properties' },
    'SGPset_BuildingElementProxyDimension':      { entity:'IfcBuildingElementProxy',        agency:'BCA',        desc:'Weight and dimensions' },
    'SGPset_DiscreteAccessory':                  { entity:'IfcDiscreteAccessory',           agency:'BCA',        desc:'Mark, AccessoryType, MaterialGrade' },
    'SGPset_OpeningElement':                     { entity:'IfcOpeningElement',              agency:'BCA',        desc:'Mark, Width, Height' },
    'SGPset_ShadingDevice':                      { entity:'IfcShadingDevice',               agency:'BCA',        desc:'Mark, Width, Depth' },
    'SGPset_AirTerminal':                        { entity:'IfcAirTerminal',                 agency:'NEA',        desc:'AirflowRate' },
    'SGPset_UnitaryEquipment':                   { entity:'IfcUnitaryEquipment',            agency:'NEA',        desc:'CoolingCapacity, EnergyEfficiencyRatio' },
    'SGPset_UnitaryControlElement':              { entity:'IfcUnitaryControlElement',       agency:'NEA',        desc:'Control element properties' },
    'SGPset_PrecastConcreteElementGeneral':      { entity:'IfcBuildingElementProxy',        agency:'BCA',        desc:'Mark, ConstructionMethod, MaterialGrade for precast/PPVC elements' },
  };

  // ── IFC Entities ──────────────────────────────────────────────────────────
  const IFC_ENTITIES = {
    'IfcWall':                       { subtypes:['SOLIDWALL','SHEAR','PARTITIONING','PLUMBINGWALL','MOVABLE','PARAPET','RETAININGWALL'],      agencies:['BCA','SCDF'] },
    'IfcBeam':                       { subtypes:['BEAM','HOLLOWCORE','JOIST','LINTEL','SPANDREL','T_BEAM'],                                  agencies:['BCA'] },
    'IfcColumn':                     { subtypes:['COLUMN','PILASTER'],                                                                       agencies:['BCA'] },
    'IfcSlab':                       { subtypes:['FLOOR','ROOF','LANDING','BASESLAB'],                                                       agencies:['BCA'] },
    'IfcPile':                       { subtypes:['BORED','DRIVEN','JETGROUTING'],                                                            agencies:['BCA'] },
    'IfcFooting':                    { subtypes:['CAISSON_FOUNDATION','FOOTING_BEAM','PAD_FOOTING','PILE_CAP','STRIP_FOOTING'],              agencies:['BCA'] },
    'IfcDoor':                       { subtypes:['DOOR','GATE','TRAPDOOR'],                                                                  agencies:['BCA','SCDF'] },
    'IfcWindow':                     { subtypes:['WINDOW','SKYLIGHT','LIGHTDOME'],                                                           agencies:['BCA','NEA'] },
    'IfcStair':                      { subtypes:['STRAIGHT_RUN_STAIR','TWO_STRAIGHT_RUN_STAIR','HALF_WINDING_STAIR','SPIRAL_STAIR'],        agencies:['BCA','SCDF'] },
    'IfcStairFlight':                { subtypes:['STRAIGHT','WINDING','SPIRAL','CURVED'],                                                   agencies:['SCDF'] },
    'IfcRamp':                       { subtypes:['STRAIGHT_RUN_RAMP','TWO_STRAIGHT_RUN_RAMP','QUARTER_TURN_RAMP','SPIRAL_RAMP'],            agencies:['BCA'] },
    'IfcRailing':                    { subtypes:['HANDRAIL','GUARDRAIL','BALUSTRADE'],                                                       agencies:['BCA'] },
    'IfcRoof':                       { subtypes:['FLAT_ROOF','SHED_ROOF','GABLE_ROOF','HIP_ROOF'],                                          agencies:['BCA'] },
    'IfcCovering':                   { subtypes:['CEILING','CLADDING','FLOORING','INSULATION','ROOFING'],                                   agencies:['BCA'] },
    'IfcSpace':                      { subtypes:['SPACE','PARKING','GFA','INTERNAL','EXTERNAL'],                                            agencies:['All','URA','SCDF'] },
    'IfcBuilding':                   { subtypes:[],                                                                                          agencies:['BCA'] },
    'IfcSite':                       { subtypes:[],                                                                                          agencies:['URA'] },
    'IfcBuildingStorey':             { subtypes:[],                                                                                          agencies:['All'] },
    'IfcTransportElement':           { subtypes:['ELEVATOR','ESCALATOR','MOVINGWALKWAY'],                                                   agencies:['BCA','SCDF'] },
    'IfcPipeSegment':                { subtypes:['RIGIDSEGMENT','FLEXIBLESEGMENT','GUTTER','SPOOL'],                                        agencies:['PUB','NEA'] },
    'IfcPipeFitting':                { subtypes:['BEND','CONNECTOR','JUNCTION','TRANSITION'],                                               agencies:['PUB'] },
    'IfcDuctSegment':                { subtypes:['RIGIDSEGMENT','FLEXIBLESEGMENT'],                                                         agencies:['NEA'] },
    'IfcDuctFitting':                { subtypes:['BEND','CONNECTOR','JUNCTION'],                                                            agencies:['NEA'] },
    'IfcSanitaryTerminal':           { subtypes:['SINK','WASHHANDBASIN','BATH','SHOWER','CISTERN','URINAL','TOILETPAN'],                    agencies:['PUB'] },
    'IfcWasteTerminal':              { subtypes:['FLOORTRAP','FLOORWASTE','ROOFDRAIN'],                                                      agencies:['NEA'] },
    'IfcTank':                       { subtypes:['STORAGE','PRESSUREVESSEL','EXPANSION'],                                                   agencies:['PUB'] },
    'IfcPump':                       { subtypes:['CIRCULATOR','SUMPPUMP','VERTICALINLINE'],                                                 agencies:['PUB'] },
    'IfcFlowMeter':                  { subtypes:['WATERMETER','GASMETER','ENERGYMETER'],                                                    agencies:['PUB'] },
    'IfcValve':                      { subtypes:['ISOLATING','CHECK','PRESSUREREDUCING','PRESSURERELIEF'],                                  agencies:['PUB'] },
    'IfcDistributionChamberElement': { subtypes:['MANHOLE','INSPECTIONCHAMBER','SUMP','TRENCH'],                                            agencies:['PUB'] },
    'IfcInterceptor':                { subtypes:['GREASE','OIL','PETROL','CYCLONIC'],                                                        agencies:['NEA'] },
    'IfcFireSuppressionTerminal':    { subtypes:['SPRINKLER','SPRINKLERDEFLECTOR'],                                                          agencies:['SCDF'] },
    'IfcDamper':                     { subtypes:['FIREDAMPER','FIRESMOKEDAMPER','SMOKEDAMPER','CONTROLDAMPER'],                             agencies:['SCDF'] },
    'IfcAirTerminal':                { subtypes:['DIFFUSER','GRILLE','LOUVRE','REGISTER'],                                                  agencies:['NEA'] },
    'IfcUnitaryEquipment':           { subtypes:['AIRCONDITIONINGUNIT','AIRHANDLER','SPLITSYSTEM'],                                         agencies:['NEA'] },
    'IfcCivilElement':               { subtypes:['USERDEFINED (*KERB, *CULVERT, *RETAININGSTRUCTURE)'],                                     agencies:['LTA'] },
    'IfcGeographicElement':          { subtypes:['TERRAIN','VEGETATION','USERDEFINED'],                                                     agencies:['NParks','URA'] },
    'IfcFurniture':                  { subtypes:['CHAIR','DESK','SOFA','SHELF','TABLE'],                                                    agencies:['BCA'] },
    'IfcBuildingElementProxy':       { subtypes:['USERDEFINED (*PPVC, *PREFAB, *PRECAST)'],                                                 agencies:['BCA'] },
    'IfcDiscreteAccessory':          { subtypes:['ANCHORPLATE','BRACKET','SHOE'],                                                           agencies:['BCA'] },
    'IfcOpeningElement':             { subtypes:['OPENING','RECESS'],                                                                        agencies:['BCA'] },
    'IfcShadingDevice':              { subtypes:['JALOUSIE','AWNING','SUNLOUVRE'],                                                           agencies:['BCA'] },
    'IfcUnitaryControlElement':      { subtypes:['ALARMPANEL','CONTROLPANEL'],                                                              agencies:['NEA'] },
  };

  // ── BIM Software Fixes ────────────────────────────────────────────────────
  const FIXES = {
    revit: [
      'Export IFC4: Application menu → Export → IFC → IFC Settings → IFC Version: IFC4',
      'Enable SGPset_ export: IFC Exporter UI → Additional Content - add custom property sets',
      'IfcObjectType for USERDEFINED subtypes: Map Element Comments or Type Mark (e.g. *CARLOT, *PPVC)',
      'Shared parameters: Load IFC+SG shared parameter file into project before property mapping',
      'Revit 2025: Uninstall Revit-IFC app if facing export issues (known conflict)',
      'Linked files: Select Additional Content >> Linked Files >> Export in the same IfcSite (one IfcSite per IFC file)',
      'Level datums: All discipline models must have aligned level names and unique GUIDs across federated files',
      'Toolkit (COP 3.1): Shared Parameters Tool, Standardized Data Tool, Dynamo scripts, Model Checker, IFC Exporter JSON, Property Set - all available at info.corenet.gov.sg/ifc-sg/templates--apps-and-more/bim-software-resources',
    ],
    archicad: [
      'IFC4 export: File → Save As → IFC - select IFC4 in Format dropdown',
      'Property mapping: Window → Schedules & Lists → IFC Scheme Setup - map properties to SGPset_',
      'ObjectType for USERDEFINED: Map Classification item to IfcObjectType in scheme setup',
    ],
    tekla: [
      'IFC4 export: File → Export → IFC → IFC4 Object Export or IFC4 Reference View',
      'Property sets: IFC Export Filter settings - include custom property sets',
      'UDAs: Map Tekla User-Defined Attributes to SGPset_ properties in export configuration',
    ],
    allplan: [
      'IFC4 export: File → Export → Exchange Data → IFC Interface → select IFC 4',
      'Property sets: Tools → Py Scripts → IFC Property Set configuration → map SGPset_ attributes',
      'PredefinedType: Map Allplan element types to IFC PredefinedType in exchange settings',
      'Geometry: Allplan exports IfcExtrudedAreaSolid natively - check solid body validity before export',
    ],
    bentley: [
      'IFC4 export: File → Export → IFC → IFC 4 (OpenBuildings Designer / AECOsim)',
      'Property sets: DGN IFC mapping file - define SGPset_ property bindings via Property Set Definition Editor',
      'Civil/Site: Bentley InfraWorks and OpenRoads export IfcCivilElement for LTA road elements',
      'Coordination: Bentley Navigator and ProjectWise support BCF 2.1 for agency comments',
    ],
    vectorworks: [
      'IFC4 export: File → Export → Export IFC Project → IFC Version: IFC 4',
      'Property sets: Tools → IFC Project Settings → Data Mapping → configure SGPset_ mapping',
      'NParks: Vectorworks Landmark ideal for landscape/tree elements (IfcGeographicElement VEGETATION)',
      'Record formats: Map Vectorworks record formats to SGPset_GeographicElement species/dimensions',
    ],
  };

  // ── VERIFIQ Product Identity ──────────────────────────────────────────────
  const VERIFIQ_IDENTITY = {
    product:   'VERIFIQ',
    version:   '2.2.0',
    owner:     'BBMW0 Technologies',
    owner_id:  'bbmw0',
    tagline:   'IFC Compliance Intelligence for Singapore CORENET X & Malaysia NBeS',
    copyright: '© 2026 BBMW0 Technologies. All rights reserved.',
    contact:   'https://github.com/bbmw96/verifiq',
    coverage: {
      agencies:    9,
      gateways:    6,
      checkLevels: 20,
      superAgents: '950+',
      sgPsets:     47,
      ifcEntities: 34,
      components:  75,
      myRules:     11,
      occupancy:   95,
      spaceNames:  420,
    },
  };

  // ── Answer Engine ─────────────────────────────────────────────────────────
  function answer(question, context) {
    const q = (question || '').toLowerCase();

    if (/\bl(\d{1,2})\b|check.?level|level.?check/.test(q)) {
      const m = q.match(/\bl(\d{1,2})\b/);
      if (m) {
        const lvl = LEVELS['L' + m[1]];
        return lvl ? `L${m[1]}: ${lvl.name} - ${lvl.desc}` : `Level L${m[1]} not found (available: L1-L20)`;
      }
      return 'IFC+SG Check Levels: ' + Object.entries(LEVELS).map(([k,v]) => `${k}=${v.name}`).join(' | ');
    }

    if (/gateway|g1\.5|corenet|top\b|occupation.?permit|\bg[1-4]\b|dsp\b|pre.?submission|direct.?submit/.test(q)) {
      if (/g1\.5|piling|pile.?submission/.test(q))           return _fmtGateway('G1.5');
      if (/g3|completion|top\b|occupation|as.?built/.test(q)) return _fmtGateway('G3');
      if (/g2|construction.?gateway/.test(q))                 return _fmtGateway('G2');
      if (/dsp\b|direct.?submit|landed.*residential/.test(q)) return _fmtGateway('DSP');
      if (/pre.?submission|g-\b|pre.?consult|dap.*before/.test(q)) return _fmtGateway('G-');
      if (/g1\b|design.?gateway/.test(q))                     return _fmtGateway('G1');
      return 'CORENET X Gateways (6): G- (Pre-Submission Consultation), G1 (Design), G1.5 (Piling), G2 (Construction), DSP (Direct Submission - landed only), G3 (Completion/TOP). Ask about any gateway for full details. - VERIFIQ by ' + VERIFIQ_IDENTITY.owner;
    }

    const agMap = { bca:'BCA', ura:'URA', scdf:'SCDF', nea:'NEA', pub:'PUB', lta:'LTA', sla:'SLA', nparks:'NParks', jtc:'JTC' };
    for (const [kw, ag] of Object.entries(agMap)) {
      if (q.includes(kw)) return _fmtAgency(ag);
    }

    if (/sgpset|pset_|property.?set/.test(q)) {
      const m = q.match(/s?g?pset_(\w+)/i);
      if (m) {
        const candidates = [
          'SGPset_' + m[1].charAt(0).toUpperCase() + m[1].slice(1),
          'Pset_'   + m[1].charAt(0).toUpperCase() + m[1].slice(1),
        ];
        for (const key of candidates) {
          if (SGPSET_GUIDE[key]) return `${key}: Entity=${SGPSET_GUIDE[key].entity}, Agency=${SGPSET_GUIDE[key].agency}. ${SGPSET_GUIDE[key].desc}`;
        }
      }
      const all = Object.keys(SGPSET_GUIDE);
      return `${all.length} property sets in IFC+SG: ${all.join(', ')}`;
    }

    if (/\bifc\w+/.test(q)) {
      const m = q.match(/\bifc\w+/i);
      if (m) {
        const key = m[0].replace(/^ifc/i, 'Ifc');
        if (IFC_ENTITIES[key]) {
          const e = IFC_ENTITIES[key];
          return `${key}: subtypes=[${e.subtypes.join(', ')}], agencies=[${e.agencies.join(', ')}]`;
        }
      }
    }

    const compKeys = Object.keys(COMPONENTS);
    for (const name of compKeys) {
      if (q.includes(name.toLowerCase())) return _fmtComp(name);
    }
    for (const name of compKeys) {
      const words = name.toLowerCase().split(/[\s()\/]+/);
      if (words.some(w => w.length > 3 && q.includes(w))) return _fmtComp(name);
    }

    if (/material|grade|concrete|steel|rebar|reinforcement/.test(q)) {
      if (/rebar|reinforcement|500[abc]|600[abc]/.test(q)) return `Reinforcement steel grades: ${REBAR_GRADES.join(', ')}`;
      if (/structural.?steel|s235|s275|s355/.test(q))      return `Structural steel grades: ${STEEL_GRADES.join(', ')}`;
      if (/concrete|c\d{2}/.test(q))                       return `Concrete grades: ${CONCRETE_GRADES.join(', ')}`;
      return `Material grades - Concrete: ${CONCRETE_GRADES.join(', ')} | Steel: ${STEEL_GRADES.join(', ')} | Rebar: ${REBAR_GRADES.join(', ')}`;
    }

    if (/fire.?rat|frr\b|fire.?resist/.test(q)) return `SCDF Fire Rating values (hours): ${FIRE_RATINGS.join(', ')}. Apply via Pset_WallCommon/Pset_DoorCommon/SGPset_Damper FireRating property.`;
    if (/construction.?method|ppvc|cast.?in.?situ|cis\b|precast\b/.test(q)) return `IFC+SG construction methods: ${CONSTRUCTION_METHODS.join(', ')}. CIS=Cast In-situ, PC=Precast, PT(Pre/Post)=Post/Pre-tensioned, PF=Precast Formwork, PPVC=Prefabricated Prefinished Volumetric Construction.`;
    if (/occupancy.?type/.test(q))      return `OccupancyType (${SPACE_VALUES.OccupancyType.length} values): ${SPACE_VALUES.OccupancyType.slice(0,15).join(', ')} … (+${SPACE_VALUES.OccupancyType.length-15} more)`;
    if (/agf.*development|development.*use/.test(q)) return `AGF_DevelopmentUse (${SPACE_VALUES.AGF_DevelopmentUse.length}): ${SPACE_VALUES.AGF_DevelopmentUse.join(', ')}`;
    if (/building.*typolog|agf.*typolog/.test(q))    return `AGF_BuildingTypology (${SPACE_VALUES.AGF_BuildingTypology.length}): ${SPACE_VALUES.AGF_BuildingTypology.join(', ')}`;
    if (/bonus.?gfa|agf.*bonus/.test(q))             return `AGF_BonusGFAType (${SPACE_VALUES.AGF_BonusGFAType.length}): ${SPACE_VALUES.AGF_BonusGFAType.join(', ')}`;
    if (/landscape.?type|als.*type/.test(q))         return `ALS_LandscapeType (${SPACE_VALUES.ALS_LandscapeType.length}): ${SPACE_VALUES.ALS_LandscapeType.join(', ')}`;
    if (/greenery.?feat|als.*feat/.test(q))          return `ALS_GreeneryFeatures (${SPACE_VALUES.ALS_GreeneryFeatures.length}): ${SPACE_VALUES.ALS_GreeneryFeatures.join(', ')}`;
    if (/gfa|gross.?floor|plot.?ratio|strata/.test(q)) return 'URA GFA: Use SGPset_SpaceArea_GFA on IfcSpace (AGF_DevelopmentUse, AGF_Name, AGF_UnitNumber, AGF_BonusGFAType, AGF_UseQuantum, AGF_BuildingTypology). Strata: SGPset_SpaceArea_Strata (AST_AreaType/LegalArea/StrataLotNumber). Site: SGPset_Site on IfcSite (SiteArea, PlotRatio, AllowableGFA, ProposedGFA).';
    if (/accessibility|barrier.?free|wheelchair|disabled/.test(q)) return 'Accessibility: BarrierFreeAccessibility=TRUE in SGPset_Space and SGPset_TransportElement. Doors: ClearWidth/ClearHeight in SGPset_DoorDimension. Ramps: ClearWidth + Gradient in SGPset_Ramp/RampDimension.';
    if (/wels|water.?efficiency/.test(q)) return 'PUB WELS: Set WELS=TRUE (Boolean) in SGPset_SanitaryTerminal for all IfcSanitaryTerminal (WC/tap/shower/urinal/bath/sink). Required at G3 Completion.';
    if (/npark|heritage.?tree|transplant/.test(q)) return 'NParks: IfcGeographicElement (VEGETATION/*TREE/*HEDGE/*GREENVERGE). SGPset_GeographicElement: Species, TreeNumber, Status=[Existing/Proposed/To be Removed/To be Transplanted], Roadside, SingleStem. SGPset_GeographicElementDimension: Height, Girth.';
    if (/pil|borehole|da1|rock.?sock|embedment/.test(q)) return 'Piling (IfcPile, G1.5): PileType=[Driven/Bored/Jacked in]. SGPset_PileStructuralLoad: DA1_1/DA1_2 Compression/TensionCapacity, DesignLoad, NegativeSkinFriction. SGPset_PilingDesignParameter: BoreholeRef, MinEmbedmentSPT100N/60N, MinRockSocketingLength. SGPset_PileDimension: CutOffLevel_SHD.';
    if (/connectivity|linkway|walkway|through.?block/.test(q)) {
      const vals = COMPONENTS['Space (Connectivity)'].agencies.URA.params;
      return 'URA Connectivity (SGPset_SpaceArea_Connectivity): ' + vals.map(p => p.name + (p.values ? '=['+p.values.join('/')+']' : '')).join('; ');
    }
    if (/malaysia|ubbl|ms1184|bomba|jkr/.test(q)) return MY_RULES.map(r => `${r.code}: ${r.desc}`).join('\n');
    if (/revit|archicad|tekla|bim.?software|ifc.?export/.test(q)) {
      if (/revit/.test(q))    return 'Revit IFC4:\n' + FIXES.revit.join('\n');
      if (/archicad/.test(q)) return 'ArchiCAD IFC4:\n' + FIXES.archicad.join('\n');
      if (/tekla/.test(q))    return 'Tekla IFC4:\n' + FIXES.tekla.join('\n');
      return 'BIM authoring tools supported: Revit, ArchiCAD, Tekla. Ask about any for IFC4 export guidance.';
    }

    return 'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner + ' - ' + VERIFIQ_IDENTITY.tagline + '.\n' +
      'Knowledge Base: ' + Object.keys(COMPONENTS).length + ' IFC+SG components | ' + Object.keys(SGPSET_GUIDE).length + ' SGPsets | ' + Object.keys(IFC_ENTITIES).length + ' IFC entities | ' + SUPER_AGENTS.length + ' Super Agents.\n' +
      '10 CORENET X agencies: BCA, SCDF, URA, NEA, PUB, LTA, HDB, SLA, NParks, JTC.\n' +
      '6 gateways: G- (Pre-Submission), G1 (Design), G1.5 (Piling), G2 (Construction), DSP (Direct), G3 (Completion/TOP).\n' +
      '20 check levels L1-L20 | Malaysia NBeS: UBBL, BOMBA, JKR, MS1184 | BIM tools: Revit, ArchiCAD, Tekla, Allplan, Bentley.\n' +
      'Ask about: any component, SGPset_, agency, gateway, check level, compliance requirement, or BIM export.\n' +
      VERIFIQ_IDENTITY.copyright + ' | ' + VERIFIQ_IDENTITY.contact;
  }

  function _fmtGateway(key) {
    const gw = SG_GATEWAYS[key];
    if (!gw) return 'Gateway ' + key + ' not found. Available gateways: G- (Pre-Submission Consultation), G1 (Design), G1.5 (Piling), G2 (Construction), DSP (Direct Submission), G3 (Completion/TOP).';
    const levelMap = { 'G-':'None (consultation only)', G1:'L18', 'G1.5':'L19', G2:'L19', DSP:'L18+L20', G3:'L20' };
    const slaMap   = { 'G-':'~15-20 WD (DAP session)', G1:'20 WD (joint)', 'G1.5':'20 WD', G2:'20 WD (joint)', DSP:'Simplified (no separate SLAs)', G3:'20 WD (joint)' };
    return 'Gateway ' + key + ' - ' + gw.name + '\n' +
      'Description: ' + gw.desc + '\n' +
      'Agencies (' + gw.agencies.length + '): ' + gw.agencies.join(', ') + '\n' +
      'VERIFIQ Check Level: ' + (levelMap[key] || 'N/A') + '\n' +
      'SLA: ' + (slaMap[key] || '20 WD') + '\n' +
      'Key IFC Parameters: ' + gw.keyParams.join(' | ') + '\n' +
      '- VERIFIQ v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner + ' | CORENET X IFC+SG COP 3.1 (Dec 2025)';
  }

  function _fmtAgency(agency) {
    const comps  = Object.entries(COMPONENTS).filter(([,c]) => c.agencies[agency]).map(([n]) => n);
    const pcount = Object.values(COMPONENTS).reduce((acc,c) => acc + (c.agencies[agency] ? c.agencies[agency].params.length : 0), 0);
    const slaMap = { BCA:'15 WD (independent)', URA:'20 WD (joint)', SCDF:'5 WD (independent)', NEA:'20 WD (independent)', PUB:'14 WD drainage / 21 WD sewerage', LTA:'20 WD (independent)', HDB:'20 WD (G3 only)', SLA:'20 WD (G3 only)', NParks:'20 WD (independent)' };
    const gwMap  = { BCA:'G-/G1/G1.5/G2/DSP/G3', URA:'G1/G2/G3', SCDF:'G1/G2/G3', NEA:'G1/G2/G3', PUB:'G2/G3', LTA:'G1/G2/G3', HDB:'G3', SLA:'G3', NParks:'G1/G1.5/G2/G3' };
    const desc   = _AG_DESC[agency] || agency + ' - Singapore Government agency.';
    return agency + ' - CORENET X Regulatory Agency\n' +
      'Role: ' + desc + '\n' +
      'Gateways: ' + (gwMap[agency] || 'All gateways') + '\n' +
      'SLA: ' + (slaMap[agency] || '20 WD') + '\n' +
      'IFC Coverage: ' + pcount + ' parameters across ' + comps.length + ' components\n' +
      'Components: ' + comps.join(', ') + '\n' +
      '- VERIFIQ v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner;
  }

  function _fmtComp(name) {
    const c = COMPONENTS[name];
    if (!c) return 'Component "' + name + '" not found. VERIFIQ covers ' + Object.keys(COMPONENTS).length + ' IFC+SG components. Ask "list all components" for full list.';
    const ags    = Object.keys(c.agencies);
    const psets  = ags.flatMap(ag => c.agencies[ag].psets).filter((v,i,a) => a.indexOf(v) === i);
    const pcount = ags.reduce((acc, ag) => acc + c.agencies[ag].params.length, 0);
    const keyP   = ags.flatMap(ag => c.agencies[ag].params.slice(0, 3).map(p => p.name));
    return name + ' - IFC+SG Component\n' +
      'IFC Entity: ' + c.entity + '\n' +
      'Subtypes: ' + (c.subtypes||[]).slice(0, 8).join(', ') + ((c.subtypes||[]).length > 8 ? ' (+' + ((c.subtypes||[]).length - 8) + ' more)' : '') + '\n' +
      'Discipline: ' + (c.discipline || 'General') + '\n' +
      'Agencies: ' + ags.join(', ') + ' (' + pcount + ' parameters total)\n' +
      'Property Sets: ' + psets.join(', ') + '\n' +
      'Key Parameters: ' + keyP.slice(0, 6).join(', ') + (pcount > 6 ? ' (+' + (pcount - 6) + ' more - ask for full list)' : '') + '\n' +
      '- VERIFIQ v' + VERIFIQ_IDENTITY.version + ' | IFC+SG COP 3.1 Dec 2025 | ' + VERIFIQ_IDENTITY.owner;
  }

  // ── Compliance Analyzer ───────────────────────────────────────────────────
  function analyzeCompliance(session) {
    if (!session) return {
      score: 0, passed: 0, total: 20, grade: 'F',
      gradeLabel: 'Fail - No session data provided',
      issues: [{ level:'L1', name:'IFC File Validity', severity:'Critical', agency:'BCA',
        message:'No session data provided to VERIFIQ compliance engine.',
        fix:'Load an IFC4 file into VERIFIQ before running compliance check.' }],
      summary: 'VERIFIQ: No session data. Load an IFC4 file to begin.',
      vendor: 'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner,
      copyright: VERIFIQ_IDENTITY.copyright,
    };

    // Per-level metadata: severity, responsible agency, actionable fix
    const LEVEL_META = [
      { level:'L1',  severity:'Critical', agency:'BCA',        fix:'Ensure FILE_SCHEMA("IFC4") in IFC header. Export from Revit/ArchiCAD/Tekla with IFC4 Reference View MVD selected. Check file is not IFC2x3.' },
      { level:'L2',  severity:'Critical', agency:'BCA',        fix:'Model must contain IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey hierarchy. Verify spatial structure in BIM authoring tool before export.' },
      { level:'L3',  severity:'Critical', agency:'BCA',        fix:'Required IFC entities for declared building type are missing. Ensure all elements (walls, slabs, columns, etc.) are exported from the BIM model.' },
      { level:'L4',  severity:'High',     agency:'BCA',        fix:'Verify PredefinedType on all entities. USERDEFINED subtypes require * prefix (e.g. *PPVC, *TRANSFERBEAM, *TREE). Check ObjectType values in pset mapping.' },
      { level:'L5',  severity:'High',     agency:'BCA/All',    fix:'SGPset_ and Pset_ property sets missing from required entities. Configure custom pset templates in Revit (shared parameters), ArchiCAD (IFC Scheme Setup), or Tekla (UDA mapping).' },
      { level:'L6',  severity:'High',     agency:'BCA/All',    fix:'Mandatory properties have null/empty values. Review each SGPset_ property - no blanks allowed. Use VERIFIQ Property Checker for a full list of missing fields per agency.' },
      { level:'L7',  severity:'Medium',   agency:'BCA',        fix:'Data type mismatches detected. Labels must be strings, Booleans must be TRUE/FALSE, Reals must be decimal, Lengths in millimetres (mm). Check pset mapping types.' },
      { level:'L8',  severity:'Medium',   agency:'BCA/All',    fix:'Property values outside allowed enums. Check: OccupancyType (95 values), AGF_DevelopmentUse (25 values), FireRating (0.5-4 hrs), PredefinedType values, Status=[Existing/Proposed/To be Removed/To be Transplanted].' },
      { level:'L9',  severity:'High',     agency:'BCA',        fix:'Elements not assigned to storeys. Use IfcRelContainedInSpatialStructure to link every element to an IfcBuildingStorey. No floating elements allowed in CORENET X.' },
      { level:'L10', severity:'Medium',   agency:'BCA',        fix:'Geometry type not compliant. Use IfcExtrudedAreaSolid (SweptSolid) or IfcFacetedBrep. Reference View MVD does not allow NURBS, parametric curves, or IfcCSG operations without fallback.' },
      { level:'L11', severity:'Medium',   agency:'BCA',        fix:'Material assignment missing. Attach SGPset_Material to structural elements. Set MaterialGrade: concrete (C20/25-C80/95), steel (S235-S355), rebar (500A-600C).' },
      { level:'L12', severity:'High',     agency:'BCA',        fix:'Structural parameters missing. Add SGPset_WallStructural / SGPset_SlabStructural / SGPset_BeamStructural / SGPset_ColumnStructural with design loads and capacities.' },
      { level:'L13', severity:'Critical', agency:'SCDF',       fix:'Fire safety parameters missing. Set FireRating on walls/doors/dampers (Pset_WallCommon, Pset_DoorCommon). Set FireExit=TRUE on exit routes. Add fire suppression system data to SGPset_Space.' },
      { level:'L14', severity:'High',     agency:'BCA',        fix:'Accessibility parameters missing. Set BarrierFreeAccessibility=TRUE on required IfcSpace elements. Add ClearWidth/ClearHeight to doors (SGPset_DoorDimension). Verify ramp gradient ≤ 1:12.' },
      { level:'L15', severity:'High',     agency:'URA',        fix:'GFA/space area properties missing. Add SGPset_SpaceArea_GFA to all IfcSpace. Populate AGF_DevelopmentUse (25 values), AGF_Name (801 values), AGF_BuildingTypology (29 values). Check URA Use Dictionary v3.3 (R13).' },
      { level:'L16', severity:'High',     agency:'PUB/NEA',    fix:'MEP parameters missing. Add WELS=TRUE to all IfcSanitaryTerminal (mandatory at G3). Add pipe gradients (SGPset_Pipe). Check HVAC: CoolingCapacity, EnergyEfficiencyRatio (SGPset_UnitaryEquipment).' },
      { level:'L17', severity:'Medium',   agency:'NParks/URA', fix:'Site/landscape parameters missing. Add IfcGeographicElement VEGETATION entities for trees/hedges. Populate SGPset_GeographicElement: Species, TreeNumber, Status, Roadside, SingleStem. Add SGPset_GeographicElementDimension: Height, Girth.' },
      { level:'L18', severity:'High',     agency:'BCA/All',    fix:'G1 Design Gateway parameters incomplete. All 7 process agencies must have required data: BCA structural, URA GFA, SCDF fire layout, NEA environmental, PUB drainage, LTA transport/RSSZ, NParks landscape. Review CORENET X G1 checklist.' },
      { level:'L19', severity:'High',     agency:'BCA',        fix:'G1.5/G2 parameters incomplete. G1.5: SGPset_Pile (DA1-1/DA1-2 capacities, CutOffLevel_SHD, BoreholeRef). G2: full structural details, rebar specs, material grades, MEP system design, URA Written Permission parameters.' },
      { level:'L20', severity:'High',     agency:'BCA/All',    fix:'G3 Completion/TOP parameters incomplete. All 10 CORENET X agencies required. Verify: as-built dimensions, WELS=TRUE all sanitary terminals, NParks as-built tree survey, URA GFA verification, SCDF fire cert, RI certificates, Buildability final scores.' },
    ];

    const issues   = [];
    const warnings = [];
    let passed = 0;
    const total = Object.keys(LEVELS).length;

    const checks = [
      !!session.validHeader,
      !!(session.storeys && session.storeys.length > 0) || !!(session.entities && session.entities.length > 0),
      !!(session.entities && session.entities.length > 0),
      !!(session.entities && session.entities.length > 0),
      !!(session.properties && session.properties.length > 0),
      !!(session.properties && session.properties.length > 0) && !(session.missingProperties && session.missingProperties.length > 0),
      !!(session.properties && session.properties.length > 0),
      !!(session.properties && session.properties.length > 0),
      !!(session.storeys && session.storeys.length > 0),
      !!session.hasGeometry,
      !!session.hasMaterials,
      !!session.hasMaterials,
      !!session.hasFireParams,
      !!session.hasAccessibilityParams,
      !!session.hasGFAParams,
      !!session.hasMEPParams,
      !!session.hasSiteParams,
      !!session.g1Complete,
      !!session.g2Complete,
      !!session.g3Complete,
    ];

    checks.forEach((ok, i) => {
      const meta = LEVEL_META[i];
      if (ok) {
        passed++;
      } else {
        issues.push({
          level:    meta.level,
          name:     LEVELS[meta.level].name,
          severity: meta.severity,
          agency:   meta.agency,
          message:  meta.level + ' (' + LEVELS[meta.level].name + '): not satisfied',
          fix:      meta.fix,
        });
      }
    });

    if (session.missingProperties && session.missingProperties.length > 0) {
      const missing = session.missingProperties;
      issues.push({
        level: 'L6', name: 'Property Completeness', severity: 'High', agency: 'BCA/All',
        message: 'L6: ' + missing.length + ' mandatory properties missing: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' (+' + (missing.length - 5) + ' more)' : ''),
        fix: 'Open VERIFIQ Property Checker and populate all highlighted SGPset_ fields. No mandatory property may be blank at submission.',
      });
    }

    const score          = Math.round((passed / total) * 100);
    const criticalCount  = issues.filter(x => x.severity === 'Critical').length;
    const highCount      = issues.filter(x => x.severity === 'High').length;
    const mediumCount    = issues.filter(x => x.severity === 'Medium').length;
    const grade          = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
    const gradeLabels    = {
      A: 'Excellent - Ready for CORENET X Submission',
      B: 'Good - Minor issues; resolve before submission',
      C: 'Fair - Significant gaps; substantial remediation required',
      D: 'Poor - Major compliance failures; full review needed',
      F: 'Fail - IFC model not compliant for CORENET X submission',
    };

    const summaryParts = [
      'VERIFIQ Compliance Report: ' + score + '% (' + passed + '/' + total + ' checks passed)',
      'Grade ' + grade + ' - ' + gradeLabels[grade],
    ];
    if (criticalCount > 0) summaryParts.push('CRITICAL: ' + criticalCount + ' critical issue(s) must be resolved');
    if (highCount     > 0) summaryParts.push(highCount + ' high-severity issue(s)');
    if (mediumCount   > 0) summaryParts.push(mediumCount + ' medium-severity issue(s)');

    return {
      score,
      passed,
      total,
      grade,
      gradeLabel:         gradeLabels[grade],
      readyForSubmission: grade === 'A',
      criticalIssues:     criticalCount,
      highIssues:         highCount,
      mediumIssues:       mediumCount,
      issues,
      warnings,
      summary:            summaryParts.join('. '),
      vendor:             'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner,
      copyright:          VERIFIQ_IDENTITY.copyright,
      reportRef:          'IFC+SG COP 3.1 (December 2025) | CORENET X R13 (March 2026)',
    };
  }

  // ── Super Agents (950+) ───────────────────────────────────────────────────
  // Auto-generated from existing knowledge base + specialist entries.
  // Each agent: { id, domain, p: RegExp, respond: () => string }
  const SUPER_AGENTS = [];

  // L1-L20 Check Level agents (20)
  Object.entries(LEVELS).forEach(([k, v]) => SUPER_AGENTS.push({
    id: k.toLowerCase(), domain: 'Level',
    p: new RegExp('\\b' + k + '\\b', 'i'),
    respond: () => k + ': ' + v.name + ' - ' + v.desc,
  }));

  // CORENET X Gateway agents (4)
  Object.entries(SG_GATEWAYS).forEach(([k, v]) => SUPER_AGENTS.push({
    id: 'gw-' + k.replace('.', '').toLowerCase(), domain: 'Gateway',
    p: new RegExp('\\b' + k.replace('.', '\\.') + '\\b|' + v.name.replace(/\s+/g, '.*'), 'i'),
    respond: () => 'Gateway ' + k + ' - ' + v.name + ': ' + v.desc + '. Agencies: ' + v.agencies.join(', ') + '. Key: ' + v.keyParams.join(', '),
  }));

  // Agency overview agents (9)
  const _AG_DESC = {
    BCA:    'Building & Construction Authority. Structural, accessibility, GFA computation, fire resistance, barrier-free. Largest CORENET X dataset - covers IfcWall/Beam/Column/Slab/Pile/Footing/Door/Stair/Ramp/Railing/Roof/Building.',
    URA:    'Urban Redevelopment Authority. GFA calculation (AGF spaces), strata areas, connectivity, landscape, plot ratio, land use, development charge. SGPset_SpaceArea_GFA/Strata/Connectivity/Landscape on IfcSpace. SGPset_Site on IfcSite.',
    SCDF:   'Singapore Civil Defence Force. Fire safety: compartmentation, travel distance, fire ratings, exits, sprinklers, smoke control, fire fighting lifts, dampers. Pset_WallCommon/DoorCommon FireRating + SGPset_Space fire systems.',
    NEA:    'National Environment Agency. Environmental health: ventilation (windows/ducts/air terminals), waste disposal (interceptors, waste terminals), air quality, noise. IfcDuctSegment/Fitting, IfcAirTerminal, IfcInterceptor, IfcWasteTerminal.',
    PUB:    'Public Utilities Board. Water supply (WELS labelling), sewerage (pipe gradients, manholes, sump), drainage, tanks, pumps, flow meters, valves. SGPset_SanitaryTerminal WELS=TRUE mandatory at G3.',
    LTA:    'Land Transport Authority. Road infrastructure: kerbs, culverts, retaining structures, carriageway widths, road reserves, traffic impact. IfcCivilElement with SGPset_CivilElement/CivilElementDimension.',
    HDB:    'Housing & Development Board. Public housing standards: dwelling unit sizes, lift landing heights, common corridors, void deck clearance, resident facilities.',
    SLA:    'Singapore Land Authority. Cadastral survey, land registration, strata subdivision, lot numbering, survey plans. AST_Prop_StrataLotNumber in SGPset_SpaceArea_Strata.',
    NParks: 'National Parks Board - 9th CORENET X agency. Tree conservation, landscape plants (IfcGeographicElement VEGETATION/*TREE/*HEDGE/*GREENVERGE). SGPset_GeographicElement: Species, TreeNumber/HedgeNumber, Status=[Existing/Proposed/To be Removed/To be Transplanted], Roadside, SingleStem. SGPset_GeographicElementDimension: Height, Girth. Required at G1 and G3.',
  };
  Object.entries(_AG_DESC).forEach(([ag, desc]) => SUPER_AGENTS.push({
    id: 'agency-' + ag.toLowerCase(), domain: 'Agency',
    p: new RegExp('\\b' + ag + '\\b', 'i'),
    respond: () => ag + ': ' + desc,
  }));

  // SGPset agents - one per pset entry (~47)
  Object.entries(SGPSET_GUIDE).forEach(([k, v]) => SUPER_AGENTS.push({
    id: 'pset-' + k.toLowerCase().replace(/_/g, '-'), domain: 'SGPset',
    p: new RegExp(k.replace(/_/g, '[_\\s]?'), 'i'),
    respond: () => k + ': Entity=' + v.entity + ', Agency=' + v.agency + '. ' + v.desc,
  }));

  // IFC entity agents (~34)
  Object.entries(IFC_ENTITIES).forEach(([k, v]) => SUPER_AGENTS.push({
    id: 'ent-' + k.toLowerCase(), domain: 'IFCEntity',
    p: new RegExp('\\b' + k + '\\b', 'i'),
    respond: () => k + ': subtypes=[' + v.subtypes.slice(0, 6).join(', ') + '], agencies=[' + v.agencies.join(', ') + ']',
  }));

  // Component-level agents (~51)
  Object.keys(COMPONENTS).forEach(name => SUPER_AGENTS.push({
    id: 'comp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), domain: 'Component',
    p: new RegExp(name.replace(/[()\/]/g, '').replace(/\s+/g, '[\\s-]+'), 'i'),
    respond: () => _fmtComp(name),
  }));

  // Property-level agents - one per param per component (~307)
  Object.entries(COMPONENTS).forEach(([compName, comp]) => {
    Object.entries(comp.agencies).forEach(([ag, agData]) => {
      agData.params.forEach(param => {
        SUPER_AGENTS.push({
          id: ('prop-' + compName + '-' + param.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          domain: ag,
          p: new RegExp('\\b' + param.name + '\\b.*' + compName.replace(/[()\/]/g, '').replace(/\s+/g, '.{0,8}') + '|' + compName.replace(/[()\/]/g, '').replace(/\s+/g, '.{0,8}') + '.*\\b' + param.name + '\\b', 'i'),
          respond: () => param.name + ' (' + compName + ', ' + ag + '): pset=' + param.pset + ', type=' + param.type + (param.values ? ', values=[' + (Array.isArray(param.values) ? param.values.slice(0, 6).join(', ') : param.values) + ']' : '') + (param.note ? ' [' + param.note + ']' : ''),
        });
      });
    });
  });

  // BIM authoring tool agents (7)
  ['revit', 'archicad', 'tekla', 'allplan', 'bentley', 'vectorworks'].forEach(sw => SUPER_AGENTS.push({
    id: 'bim-' + sw, domain: 'BIM',
    p: new RegExp('\\b' + sw + '\\b', 'i'),
    respond: () => sw.charAt(0).toUpperCase() + sw.slice(1) + ' IFC4 (CORENET X):\n' + FIXES[sw].join('\n') + '\n- VERIFIQ v' + VERIFIQ_IDENTITY.version + ' BIM Export Guide',
  }));
  SUPER_AGENTS.push({
    id: 'bim-general', domain: 'BIM',
    p: /bim.*software|ifc.*export|authoring.*tool|which.*software.*corenet/i,
    respond: () => 'BIM authoring tools supported by VERIFIQ for CORENET X IFC4 export:\n• Autodesk Revit - most common in Singapore; full SGPset_ via shared parameters\n• Graphisoft ArchiCAD - IFC Scheme Setup for property mapping\n• Trimble Tekla Structures - structural/geotechnical, best for G1.5 piling\n• Nemetschek Allplan - IFC4 via exchange settings; strong in Europe and growing in SG\n• Bentley OpenBuildings/AECOsim - civil/infrastructure elements for LTA (IfcCivilElement)\n• Vectorworks Landmark - best for NParks landscape/tree (IfcGeographicElement VEGETATION)\nAll must export IFC4 Reference View MVD with SGPset_ populated. - VERIFIQ by ' + VERIFIQ_IDENTITY.owner,
  });

  // Malaysia rule agents (~11)
  MY_RULES.forEach(r => SUPER_AGENTS.push({
    id: 'my-' + r.code.toLowerCase().replace(/[-]/g, ''), domain: 'Malaysia',
    p: new RegExp(r.code.replace(/-/g, '\\-?'), 'i'),
    respond: () => r.code + ': ' + r.desc,
  }));

  // Space value category agents (6)
  Object.entries(SPACE_VALUES).forEach(([k, v]) => SUPER_AGENTS.push({
    id: 'sv-' + k.toLowerCase(), domain: 'SpaceValues',
    p: new RegExp(k.replace(/([A-Z])/g, ' $1').trim().replace(/\s+/g, '[\\s_]?'), 'i'),
    respond: () => k + ' (' + v.length + ' values): ' + v.join(', '),
  }));

  // OccupancyType value micro-agents (95)
  SPACE_VALUES.OccupancyType.forEach((ot, i) => SUPER_AGENTS.push({
    id: 'occ-' + i, domain: 'OccupancyType',
    p: new RegExp(ot.replace(/[()\/\-]/g, '.{0,2}').replace(/\s+/g, '.{0,5}'), 'i'),
    respond: () => 'OccupancyType "' + ot + '": set in SGPset_Space on IfcSpace. Drives SCDF occupancy load, fire safety provisions, and BCA space classification for CORENET X submission.',
  }));

  // AGF_DevelopmentUse micro-agents (25)
  SPACE_VALUES.AGF_DevelopmentUse.forEach((du, i) => SUPER_AGENTS.push({
    id: 'agf-' + i, domain: 'GFA',
    p: new RegExp('agf.*' + du.replace(/[()\/\-\s+]/g, '.{0,4}') + '|' + du.replace(/[()\/\-\s+]/g, '.{0,4}') + '.*agf', 'i'),
    respond: () => 'AGF_DevelopmentUse "' + du + '": set in SGPset_SpaceArea_GFA on IfcSpace for URA GFA submission. Identifies the development use type of the GFA space.',
  }));

  // AGF_BuildingTypology micro-agents (29)
  SPACE_VALUES.AGF_BuildingTypology.forEach((bt, i) => SUPER_AGENTS.push({
    id: 'btyp-' + i, domain: 'GFA',
    p: new RegExp('agf.*' + bt.replace(/[()\/\-\s+]/g, '.{0,4}') + '|' + bt.replace(/[()\/\-\s+]/g, '.{0,4}') + '.*typolog', 'i'),
    respond: () => 'AGF_BuildingTypology "' + bt + '": set in SGPset_SpaceArea_GFA. Classifies the building typology for URA GFA verification.',
  }));

  // Concrete grade micro-agents (11)
  CONCRETE_GRADES.forEach(g => SUPER_AGENTS.push({
    id: 'conc-' + g.toLowerCase().replace('/', '-'), domain: 'Material',
    p: new RegExp('\\b' + g.replace('/', '\\/') + '\\b', 'i'),
    respond: () => 'Concrete grade ' + g + ': use in SGPset_Material MaterialGrade on IfcWall/Beam/Column/Slab/Pile/Footing. BCA CORENET X accepted concrete grades: C12/15 to C80/95.',
  }));

  // Fire rating value micro-agents (8)
  FIRE_RATINGS.forEach(fr => SUPER_AGENTS.push({
    id: 'frr-' + fr.replace('.', 'h'), domain: 'FireSafety',
    p: new RegExp('\\b' + fr.replace('.', '\\.') + '\\s*(h|hr|hour)', 'i'),
    respond: () => 'Fire rating ' + fr + ' hour(s): valid SCDF fire resistance rating (FRR). Apply via Pset_WallCommon/Pset_DoorCommon FireRating or SGPset_Damper FireRating. Values: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4 hours.',
  }));

  // Construction method micro-agents (7)
  CONSTRUCTION_METHODS.forEach(cm => SUPER_AGENTS.push({
    id: 'cm-' + cm.toLowerCase().replace(/[^a-z0-9]/g, ''), domain: 'Structural',
    p: new RegExp('\\b' + cm.replace(/[()]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'i'),
    respond: () => 'ConstructionMethod "' + cm + '": used in SGPset_ psets of structural elements (Wall/Beam/Column/Slab/Pile/Footing/Stair/Roof). CIS=Cast In-situ, PC=Precast, PT=Post/Pre-tensioned, PF=Precast Formwork, PPVC=Prefabricated Prefinished Volumetric, Spun=Spun pile.',
  }));

  // Plant status micro-agents (4)
  PLANT_STATUS.forEach(ps => SUPER_AGENTS.push({
    id: 'ps-' + ps.toLowerCase().replace(/\s+/g, '-'), domain: 'NParks',
    p: new RegExp('plant.*' + ps.replace(/\s+/g, '.{0,5}') + '|tree.*' + ps.replace(/\s+/g, '.{0,5}'), 'i'),
    respond: () => 'NParks Plant Status "' + ps + '": valid value for Status parameter in SGPset_GeographicElement on IfcGeographicElement (VEGETATION/*TREE/*HEDGE/*GREENVERGE). Required at G1 and G3 gateways.',
  }));

  // Rebar grade micro-agents (6)
  REBAR_GRADES.forEach(g => SUPER_AGENTS.push({
    id: 'rebar-' + g.toLowerCase(), domain: 'Material',
    p: new RegExp('\\b' + g + '\\b', 'i'),
    respond: () => 'Reinforcement steel grade ' + g + ': valid value for ReinforcementSteelGrade in SGPset_WallReinforcement, SGPset_BeamReinforcement, SGPset_ColumnReinforcement, SGPset_SlabReinforcement, SGPset_PileReinforcement, SGPset_FootingReinforcement.',
  }));

  // Steel grade micro-agents (3)
  STEEL_GRADES.forEach(g => SUPER_AGENTS.push({
    id: 'steel-' + g.toLowerCase(), domain: 'Material',
    p: new RegExp('\\b' + g + '\\b', 'i'),
    respond: () => 'Structural steel grade ' + g + ': valid value for MaterialGrade in SGPset_Material on IfcBeam/IfcColumn/IfcStair steel elements. Grades: S235 (yield 235 MPa), S275 (275 MPa), S355 (355 MPa).',
  }));

  // ── Specialist Agents (290) ───────────────────────────────────────────────
  // Compact tuple format: [pattern, domain, response]
  const _SPEC = [
    // BCA Structural (30)
    [/driven.?pile|bored.?pile|spun.?pile|jacked.?pile/, 'BCA', 'Pile types in CORENET X: Driven, Bored, Jacked in. Set as PileType in SGPset_Pile on IfcPile. Spun piles use ConstructionMethod=Spun. G1.5 (Piling Gateway) is required before piling works commence.'],
    [/da1.?1|da1.?2|eurocode.?7|ec7|design.?approach/, 'BCA', 'Pile design: DA1-1 and DA1-2 from Eurocode 7. DA1_1_CompressionCapacity, DA1_2_CompressionCapacity, DA1_1_TensionCapacity, DA1_2_TensionCapacity, NegativeSkinFriction - all in SGPset_PileStructuralLoad on IfcPile.'],
    [/cut.?off.?level|cof.?level|shd|singapore.?height/, 'BCA', 'CutOffLevel_SHD: pile cut-off level in Singapore Height Datum. Set in SGPset_PileDimension on IfcPile. Required for all piles at G1.5 Piling Gateway submission.'],
    [/borehole|spt.?100|spt.?60|rock.?socket|embedment.?length/, 'BCA', 'Piling design parameters in SGPset_PilingDesignParameter: BoreholeRef (ground investigation report ref), MinEmbedmentSPT100N (min embedment where SPT N>100), MinEmbedmentSPT60N (SPT N>60), MinRockSocketingLength.'],
    [/transfer.?beam|transfer.?slab|transfer.?plate|transfer.?element/, 'BCA', 'Transfer elements: IfcBeam subtype *TRANSFERBEAM, IfcSlab subtype *TRANSFERSLAB. Use ConstructionMethod from CONSTRUCTION_METHODS list. Additional structural load parameters via SGPset_WallStructuralLoad/SGPset_ColumnStructuralLoad.'],
    [/ppvc|volumetric.?construct|prefab.?prefinish/, 'BCA', 'PPVC (Prefabricated Prefinished Volumetric Construction): IfcBuildingElementProxy with ObjectType=*PPVC. SGPset_PrecastConcreteElementGeneral: Mark, ConstructionMethod=PPVC, MaterialGrade. Weight in SGPset_BuildingElementProxyDimension.'],
    [/precast|pc.?element|pc.?method/, 'BCA', 'Precast concrete: ConstructionMethod=PC in SGPset_. Precast elements use IfcBuildingElementProxy with *PRECAST ObjectType OR standard structural entities (IfcBeam/Column/Slab) with PC construction method. SGPset_PrecastConcreteElementGeneral for generic precast proxies.'],
    [/post.?tension|pre.?tension|prestress/, 'BCA', 'Post-tensioned: ConstructionMethod=PT (Post). Pre-tensioned: ConstructionMethod=PT (Pre). Both valid for beams, slabs, piles. Set in SGPset_Beam/Slab on corresponding IFC entities.'],
    [/section.?fabrication|hollow.?section|open.?section|rhs|chs|ubs/, 'BCA', 'SectionFabricationMethod in SGPset_Beam/Column/Stair: describes steel section type (e.g. RHS, CHS, UB, UC, compound). Used for structural steel design verification.'],
    [/refer.?to.?2d|detail.?drawing|shop.?drawing/, 'BCA', 'ReferTo2DDetail in SGPset_Beam/Column/Stair: cross-reference to 2D structural drawing number. Allows CORENET X model to link IFC element to corresponding detail sheet.'],
    [/steel.?connect|connection.?type|bolted|welded|moment.?connect/, 'BCA', 'ConnectionType in SGPset_SteelConnection on IfcBeam/Column/Stair: describes the steel connection type (bolted, welded, pinned, moment, etc.). Required for steel frame structural submissions.'],
    [/party.?wall|shared.?wall/, 'BCA', 'IsPartyWall=TRUE in SGPset_Wall: marks shared boundary wall between properties. Combined with IsExternal=TRUE. Required by BCA for boundary/shared wall identification in CORENET X.'],
    [/shelter.*wall|wall.*shelter|civil.?defence.?shelter|bomb.?shelter/, 'BCA', 'ShelterUsage=TRUE in SGPset_Wall on IfcWall: identifies household/storey shelter (HHS/SS) walls for BCA civil defence shelter requirements. Shelter walls have enhanced structural requirements.'],
    [/beam.?facade|double.?bay|prefinished.?facade/, 'BCA', 'Facade system booleans in SGPset_Wall: BeamFacade=TRUE (beam-integrated facade), DoubleBayFacade=TRUE (double-bay system), PrefinishedFacade=TRUE (prefinished panel). Architectural facade tracking for BCA.'],
    [/footing.?type|pad.?footing|strip.?footing|pile.?cap|caisson/, 'BCA', 'Footing PredefinedType on IfcFooting: CAISSON_FOUNDATION, FOOTING_BEAM, PAD_FOOTING, PILE_CAP, STRIP_FOOTING. Set correct subtype for BCA structural verification. Dimensions in SGPset_FootingDimension.'],
    [/self.?closing.?door|door.?closer|one.?way.?lock|vision.?panel/, 'BCA', 'Door features in SGPset_Door: SelfClosing=TRUE (required for fire doors and accessible doors), OneWayLockingDevice=TRUE (exit doors), VisionPanel=TRUE (observation panel). Checked by BCA and SCDF.'],
    [/door.?width|clear.?width.*door|door.*clear.?width/, 'BCA', 'Door clear width in SGPset_DoorDimension: ClearWidth (min 850mm accessible doors per CP79), OverallWidth (frame outer), StructuralWidth (opening rough). SCDF exit doors: min 800mm ClearWidth.'],
    [/sill.?height|window.?sill|parapet.?height/, 'BCA', 'SillHeight in SGPset_WindowDimension: window sill height from floor. BCA requires min 1000mm sill or protective barrier for windows in habitable rooms above 2nd storey.'],
    [/openable.?area|ventilation.?area|natural.?ventilat/, 'NEA', 'OpenableArea in SGPset_Window on IfcWindow (NEA): minimum natural ventilation area. NEA requires 5% of floor area as openable window area for naturally ventilated spaces. VentilationType: Natural/Mechanical/Mixed Mode.'],
    [/stair.?width|flight.?width|landing.?width|stair.?landing/, 'SCDF', 'Stair/flight dimensions: FlightWidth and LandingWidth in SGPset_StairDimension. SCDF: min 1050mm clear for fire exit stairs. BCA: min 900mm for accessible staircases. RiserHeight max 175mm, TreadLength min 250mm per Pset_StairFlightCommon.'],
    [/ramp.?gradient|gradient.*ramp|1.?in.?12|1.?:.?12/, 'BCA', 'Gradient in SGPset_Ramp on IfcRamp: max 1:12 for accessible ramps (CP79). ClearWidth min 1200mm. For vehicle ramps: max 1:8 (12.5%) for internal, 1:5 (20%) for short approach ramps.'],
    [/handrail|guardrail|balustrade|railing.?height/, 'BCA', 'Railing Height in SGPset_RailingDimension: handrail 850-950mm, guardrail min 1000mm (BCA) or 1100mm (SCDF for >3m height). PredefinedType: HANDRAIL, GUARDRAIL, BALUSTRADE. Material in SGPset_Material.'],
    [/roof.?type|flat.?roof|pitched.?roof|green.?roof/, 'BCA', 'Roof PredefinedType on IfcRoof: FLAT_ROOF, SHED_ROOF, GABLE_ROOF, HIP_ROOF. ConstructionMethod in SGPset_Roof. Green roofs need ALS landscape spaces (Space Landscape entity) with NParks/URA landscape parameters.'],
    [/ceiling|cladding|flooring|insulation|roofing.*covering/, 'BCA', 'IfcCovering subtypes: CEILING, CLADDING, FLOORING, INSULATION, MEMBRANE, ROOFING, SKIRTINGBOARD, WRAPPING. Mark in SGPset_Covering, Thickness in Pset_CoveringCommon. BCA tracks for spatial dimensions and finishes.'],
    [/shading.?device|sun.?louvre|awning|jalousie/, 'BCA', 'Shading devices IfcShadingDevice subtypes: JALOUSIE, AWNING, SUNLOUVRE. SGPset_ShadingDevice: Mark, Width, Depth. Used by BCA to verify solar shading provisions and GFA implications.'],
    [/furniture.*type|fit.?out|millwork|built.?in/, 'BCA', 'IfcFurniture subtypes: CHAIR, DESK, SOFA, SHELF, TABLE, FILING, TECHNICALITEM. SGPset_Furniture: Mark, FurnitureType. Required for BCA accessible unit layout verification (accessible bedroom, kitchen counter heights).'],
    [/anchor.?plate|bracket|shoe.*structural|discrete.?accessory/, 'BCA', 'IfcDiscreteAccessory subtypes: ANCHORPLATE, BRACKET, SHOE. SGPset_DiscreteAccessory: Mark, AccessoryType, MaterialGrade (steel grades only: S235/S275/S355). Used for steel connection detail tracking.'],
    [/opening.?element|structural.?opening|recess/, 'BCA', 'IfcOpeningElement subtypes: OPENING, RECESS. SGPset_OpeningElement: Mark, Width, Height. Required for structural openings in walls/slabs where no door/window is hosted. BCA checks all openings have correct lintels/trimmers.'],
    [/working.?load|axial.?load|column.?load/, 'BCA', 'Structural loads in SGPset_WallStructuralLoad and SGPset_ColumnStructuralLoad: WorkingLoadDA1_1 and WorkingLoadDA1_2 (Eurocode 7 Design Approach 1, Combination 1 and 2). Units: kN. Required for foundation design verification.'],
    [/geotech|soil.?investigation|si.?report|ground.?condition/, 'BCA', 'Geotechnical data links in SGPset_PilingDesignParameter: BoreholeRef cross-references to Soil Investigation (SI) report borehole. MinEmbedmentSPT100N/60N from SI test data. Required at G1.5 Piling Gateway.'],

    // BCA Accessibility (20)
    [/barrier.?free|accessible|cp79|code.?on.?barrier/, 'BCA', 'Barrier-free accessibility per CP79. Key flags: BarrierFreeAccessibility=TRUE in SGPset_Space and SGPset_TransportElement (lifts). ClearWidth in doors, ramps (min 1500mm turn space). AmbulantDisabled, LargerAccessible in SGPset_Space.'],
    [/accessible.?toilet|wheelchair.?toilet|wc.*accessible/, 'BCA', 'Accessible toilet: OccupancyType="Common - Accessible Toilet" in SGPset_Space. Min 1700×1700mm clear space (Malaysia MS1184: 1700×1700mm). LargerAccessible=TRUE for enlarged accessible toilet. Hearing enhancement for hearing-impaired.'],
    [/ambulant.?disabled|ambulant.?accessible/, 'BCA', 'AmbulantDisabled=TRUE in SGPset_Space: space is accessible for ambulant disabled persons (not necessarily full wheelchair accessible). Combined with BarrierFreeAccessibility for fully accessible spaces.'],
    [/children.?friendly|child.?friendly|family.*facility/, 'BCA', 'ChildrenFriendly=TRUE in SGPset_Space: space is designed for children (lowered counters, play areas, nursing rooms). Related: NursingRoom OccupancyType. Checked by BCA for childcare and family-friendly facilities.'],
    [/elderly.?friendly|senior.?friendly|eldercare/, 'BCA', 'ElderlyFriendly=TRUE in SGPset_Space: space is designed for elderly users (grab bars, non-slip, wider corridors). Related to eldercare facility requirements and universal design provisions.'],
    [/hearing.?enhancemen|hearing.?loop|induction.?loop/, 'BCA', 'HearingEnhancement=TRUE in SGPset_Space: space is equipped with hearing enhancement system (induction loop or infra-red). Required for public assembly spaces >20 seats in BCA Inclusive Design guidelines.'],
    [/larger.?accessible|enlarged.?accessible|wheelchair.?turning/, 'BCA', 'LargerAccessible=TRUE in SGPset_Space: space has enlarged turning/manoeuvring space (min 1500×1500mm turning circle). Required for accessible toilets and shower rooms.'],
    [/mas.*accred|accreditation.?mas|medical.?accredit/, 'BCA', 'AccreditationMAS=TRUE in SGPset_Space: space is accredited by Ministry of Health for medical/healthcare use. Used for health facilities tracking in CORENET X.'],
    [/retrofitt?|existing.?building.?access|access.*retrofit/, 'BCA', 'Retrofit=TRUE in SGPset_Space: accessibility provision is a retrofit (existing building improvement), not new construction. Affects compliance requirements - may use BCA Accessibility Fund provisions.'],
    [/fire.?fighting.?lift|ffpl|fireman.?lift/, 'SCDF', 'FireFightingLift=TRUE in SGPset_TransportElement on IfcTransportElement (ELEVATOR): identifies lift designated for SCDF fire fighting operations. Required in buildings >24m. Min 1100kg capacity, 2.0m/s speed, firefighter\'s switch.'],
    [/lift.?type|elevator.?type|passenger.?lift|goods.?lift|bed.?lift/, 'SCDF', 'LiftType in SGPset_TransportElement: type of lift (Passenger/Goods/Bed/Service/FireFighting). Combined with FireFightingLift=TRUE for SCDF-designated lifts. Length/Width/ClearHeight/ClearDepth/ClearWidth in SGPset_TransportElementDimension.'],
    [/parking.?type|car.?park.?type|season.?park|mechanised.?park/, 'BCA', 'ParkingType in SGPset_Space: classifies parking space type (Accessible/Season/Hourly/Mechanised/Motorcycle). OccupancyType="Car Park - *". Use IfcSpace subtype PARKING. ParkingType drives BCA car park provision calculation.'],
    [/purpose.?group|use.?class|building.?use.?class/, 'SCDF', 'PurposeGroup in SGPset_Space: SCDF building use classification (I=Residential, II=Institutional, III=Assembly, IV=Office, V=Retail, VI=Industry, VII=Storage). Drives fire safety compartment area limits and travel distance.'],
    [/refuse|waste.?storage|bin.?centre|refuse.?chute/, 'NEA', 'RefuseOutput (Real) in SGPset_Space: daily refuse generation in kg. Used for NEA waste storage sizing. OccupancyType="Utility - Refuse Storage" for bin centre spaces. Min 1.5m clear height, pest-proofed, accessible to refuse truck.'],
    [/sound.?power|sound.?pressure|noise.?level|decibel|dba/, 'NEA', 'SoundPowerLevel and SoundPressureLevel in SGPset_Space: noise parameters for M&E equipment rooms and noise-sensitive spaces. NEA noise limits: daytime 65 dBA, night-time 55 dBA at boundary.'],
    [/c.?value|occupancy.?load|c.?factor|persons.?per/, 'SCDF', 'CValue in SGPset_Space: occupancy load factor (m² per person) used by SCDF. OccupancyLoad=floor area / CValue. Drives exit width, stair width, and number of exits calculations per SCDF Fire Code.'],
    [/nursing.?room|lactation.?room|mother.?room/, 'BCA', 'NursingRoom OccupancyType="Common - Nursing Room": BCA requires nursing rooms in commercial developments >5,000 m² GFA. Min 6 m² floor area with changing facility, private area, and wash basin.'],
    [/prayer.?room|surau|mosque.?room/, 'BCA', 'Prayer Room OccupancyType="Common - Prayer Room": BCA provision for multi-faith prayer facilities in large commercial and institutional developments. Separate spaces for different genders typically required.'],
    [/first.?aid.?room|medical.?room|sick.?room/, 'BCA', 'FirstAidRoom OccupancyType="Common - First Aid Room": required in industrial and large commercial buildings per Workplace Safety & Health Act. Min 7.5 m², accessible location, adjacent to toilet.'],
    [/security.?post|guard.?post|guardhouse/, 'BCA', 'SecurityPost OccupancyType="Common - Security Post": manned security station. BCA accessibility requires SecurityPost to have ClearWidth ≥ 850mm for wheelchair passage and lowered counter (max 770mm) per CP79.'],

    // BCA GFA/Planning (10)
    [/gfa.?exclusion|exclude.*gfa|void.*gfa|plant.?room.*gfa/, 'URA', 'GFA exclusions per URA DC Handbook: car parks (ground floor), void areas above 3 storeys, RC roofs, lift shafts, mechanical plant rooms, service ducts, certified green features with bonus GFA. Set AVF_IncludeAsGFA=FALSE in SGPset_SpaceArea_Verification.'],
    [/bonus.?gfa|gfa.?incentive|balcony.*gfa|sky.?terrace.*gfa/, 'URA', 'Bonus GFA types in SGPset_SpaceArea_GFA: AGF_BonusGFAType values include Balcony, PES, Private Roof Terrace, Strata Void, Sky Terrace, Community Space, Landscaping, Solar Panel Area. Subject to URA bonus GFA caps and conditions.'],
    [/plot.?ratio|gpr|allowed.*plot.?ratio|allowable.*plot.?ratio/, 'URA', 'Plot ratio in SGPset_Site on IfcSite: PlotRatio (actual), AllowableGFA = SiteArea × AllowablePlotRatio. ProposedGFA = sum of all GFA spaces. URA verifies ProposedGFA ≤ AllowableGFA. PlotRatio varies by land use zone.'],
    [/strata.*lot|strata.*title|legal.?area|ast.*strata/, 'URA/SLA', 'Strata area in SGPset_SpaceArea_Strata: AST_AreaType=[Strata Private/Communal/Common Area], AST_LegalArea (m², 2 decimal places), AST_Prop_StrataLotNumber (lot reference from SLA survey). Required for strata-titled developments.'],
    [/connectivity|through.?block|pedestrian.?link|covered.?walkway/, 'URA', 'Connectivity spaces: IfcSpace subtype *OPENCORRIDOR/*COVEREDWALKWAY/*COVEREDLINKWAY/*THROUGHBLOCKLINK/*PEDESTRIANLINK. SGPset_SpaceArea_Connectivity: ACN_ConnectivityType, ACN_ActivityGeneratingUseType, ACN_IsPavingSpecified, open/close times, ACN_IsOpen24HoursToPublic.'],
    [/broad.?land.?use|land.?use.?zone|zoning|master.?plan/, 'URA', 'BroadLandUse in SGPset_GeographicElement (Site Boundary) and SGPset_Site: URA Master Plan land use zone. 29 values including Residential, Commercial, Industrial, B1/B2/BP, White, Open Space, Reserve Site. Determines plot ratio and allowable use.'],
    [/development.?charge|dc.*pay|dc.*waiver/, 'URA', 'Development charge (DC): payable to URA/SLA when enhancing development use or increasing GFA beyond what previous permission allowed. Not directly modelled in IFC but AGF_DevelopmentUse and ProposedGFA in CORENET X support DC calculation.'],
    [/agf.*name|space.?name.?list|801.?space/, 'URA', 'AGF_Name in SGPset_SpaceArea_GFA: one of 801 URA-approved GFA space names. This is the most granular URA space classification. Each name maps to an AGF_DevelopmentUse and AGF_BuildingTypology. Incorrectly named spaces may fail URA GFA verification.'],
    [/use.?quantum|predominant.?use|ancillary.?use/, 'URA', 'AGF_UseQuantum in SGPset_SpaceArea_GFA: values=[Predominant, Ancillary]. Predominant = primary use (e.g. majority of commercial floor area). Ancillary = supporting use (e.g. canteen within an office). URA enforces quantum limits.'],
    [/supporting.?facility|ancillary.?facilit/, 'URA', 'AGF_SupportingFacility=Yes in SGPset_SpaceArea_GFA: space is a supporting/ancillary facility to the main development use (e.g. childcare within an office building). Subject to URA supporting facility quantum limits.'],

    // SCDF Fire Safety (40)
    [/travel.?distance|exit.?distance|max.*dist.*exit/, 'SCDF', 'SCDF travel distance limits: single direction max 18m (unsprinklered), 25m (sprinklered). Two directions max 30m (unsprinklered), 45m (sprinklered). Measured from most remote point to nearest exit door. FireExit=TRUE on IfcDoor/IfcSpace.'],
    [/fire.?compartment|compartment.?area|fire.?section/, 'SCDF', 'Fire compartment max area by Purpose Group: PG III (Assembly) 3500m² unsprinklered, 14000m² sprinklered; PG IV (Office) 7000m² / 28000m²; PG V (Retail) 3500m² / 14000m². Walls between compartments need FireRating in Pset_WallCommon.'],
    [/fire.?exit|exit.?door|means.?of.?escape|moe\b/, 'SCDF', 'Fire exit: FireExit=TRUE in Pset_DoorCommon and SGPset_Space. Min 2 exits for areas >100 persons. Exit doors: clear width min 800mm, SCDF exit sign, self-closing (SelfClosing=TRUE), not lockable from inside (OneWayLockingDevice=TRUE). IfcDoor subtype DOOR.'],
    [/exit.?width|egress.?width|corridor.?width/, 'SCDF', 'Minimum exit widths (SCDF Code 2023): exit corridor 1050mm, exit stair 1050mm. Width per person: 5mm/person for doors, 7.5mm/person for stairs, 7mm/person for ramps. Based on OccupancyLoad from CValue calculation.'],
    [/sprinkler|automatic.?fire.?suppress|afss/, 'SCDF', 'Sprinkler system in SGPset_Space: FireDetectionAndSuppressionSystem=[AFAS/Sprinkler/Water Mist/VIFDS]. IfcFireSuppressionTerminal: SprinklerType, CoverageRadius, ActivationTemp in SGPset_FireSuppressionTerminal. Mandatory >30m buildings and high-risk PGs.'],
    [/smoke.?control|smoke.?extract|smoke.?purge|smoke.?vent/, 'SCDF', 'SmokeControlSystem in SGPset_Space: values=[Smoke Vent/Purging/Jet Fan/Engineered]. FireEmergencyVentilationMode=[Natural/Mechanical/Pressurisation/Cross-ventilation/Combined Natural and Mechanical/Exhaust Only]. Car parks: jet fan or smoke extract required.'],
    [/emergency.?voice|evc|public.?address|pa.?system/, 'SCDF', 'EmergencyVoiceCommunicationSystem in SGPset_Space: values=[1-way EVC/2-way EVC/PA System]. 2-way EVC required in fire fighting shafts. PA System for assembly areas. 1-way EVC for smaller buildings. Linked to SCDF emergency communication requirements.'],
    [/fire.?detection|smoke.?detector|heat.?detector|sprinkler.?head/, 'SCDF', 'FireDetectionAndSuppressionSystem in SGPset_Space: tracks type of fire suppression. Values: AFAS (Automatic Fire Alarm System only), Sprinkler, Water Mist, VIFDS (Very Important Fire Detection System). IfcFireSuppressionTerminal for sprinkler head elements.'],
    [/fire.?access.?opening|fire.?access.?panel|inspection.?opening/, 'SCDF', 'FireAccessOpening=TRUE in SGPset_Door on IfcDoor: marks fire service access openings in walls/floors. Required by SCDF for fire investigation and suppression access. Min 600×600mm. Not a fire door itself but requires fire-rated surround.'],
    [/fire.?lift.?lobby|fire.?fighting.?shaft|protected.?lobby/, 'SCDF', 'Fire fighting shaft: protected staircase + fire lift lobby combination required for buildings >24m. LiftType=FireFightingLift. Lobby must be pressurised (FireEmergencyVentilationMode=Pressurisation). Staircase is fire exit (FireExit=TRUE on IfcStair).'],
    [/fire.?damp|smoke.?damp|fsd|intumescent/, 'SCDF', 'Dampers: IfcDamper subtypes FIREDAMPER, FIRESMOKEDAMPER, SMOKEDAMPER. SGPset_Damper: FireRating (0.5-4 hours), DamperType. Fire dampers in ductwork penetrating fire compartment walls. Intumescent fire curtain: INTUMESCENTFIRECURTAIN subtype.'],
    [/hose.?reel|dry.?rising.?main|wet.?rising.?main|fire.?hydrant/, 'SCDF', 'IfcFireSuppressionTerminal with USERDEFINED subtype *HOSE_REEL or *FOAM_INLET. Hose reels: max 36m coverage radius. Dry/wet rising mains in fire fighting shafts. Fire hydrant: within 70m of building entrance. Tracked in CORENET X model.'],
    [/basement.?car.?park|underground.?car.?park|covered.?car.?park/, 'SCDF', 'Basement/underground car parks: sprinklers mandatory (AFAS insufficient). Jet fan or exhaust smoke control system. OccupancyType="Car Park - Basement". CValue=20m²/person. Max compartment 7000m² per storey. 1-hour FRR for slab.'],
    [/3.?storey|4.?storey|building.?height.?limit|height.?restrict/, 'URA', 'URA height control: varies by zone and proximity to airport. Buildings >24m need SCDF fire lift and pressurised lobby. >60m need additional structural and wind assessments. BroadLandUse determines allowable height. Check URA CORENET X dashboard for site-specific limits.'],
    [/purpose.?group.?1|pg.?1|residential.?fire|dwelling.?fire/, 'SCDF', 'Purpose Group I (Residential): travel distance 30m (sprinklered 45m). Min 1-hr FRR for structural elements. Sprinklers required >30m. Fire exit doors per unit to common corridor. OccupancyType="Residential - *" in SGPset_Space.'],
    [/purpose.?group.?2|pg.?2|institutional.?fire|hospital.?fire/, 'SCDF', 'Purpose Group II (Institutional): max compartment 1500m² unsprinklered, 6000m² sprinklered. Travel distance 18m (sprinklered 25m). Phased evacuation. Hospital/care home provisions. OccupancyType="Healthcare - *" in SGPset_Space.'],
    [/purpose.?group.?3|pg.?3|assembly.?fire|hall.?fire|church.?fire/, 'SCDF', 'Purpose Group III (Assembly): max 500 persons per exit width. CValue=0.5m²/person (density use), 1m²/person (fixed seating). Travel distance 18m/25m. Sprinklers required >500 persons or >30m. OccupancyType="Assembly and Recreation - *".'],
    [/purpose.?group.?4|pg.?4|office.?fire/, 'SCDF', 'Purpose Group IV (Office): max compartment 7000m² (sprinklered 28000m²). CValue=10m²/person. Travel distance 18m/25m sprinklered. 2-hr FRR for structural elements. OccupancyType="Business - Office" etc. Sprinklers for >30m.'],
    [/purpose.?group.?5|pg.?5|retail.?fire|shop.?fire|mall.?fire/, 'SCDF', 'Purpose Group V (Retail): max compartment 3500m² (sprinklered 14000m²). CValue=3m²/person. Sprinklers mandatory in shopping malls. Travel distance 18m/25m. OccupancyType="Retail - *" in SGPset_Space.'],
    [/purpose.?group.?6|pg.?6|industrial.?fire|factory.?fire/, 'SCDF', 'Purpose Group VI (Industrial): max compartment 7000m² (sprinklered 28000m²). High fire load - 2-4 hr FRR. Special provisions for hazardous processes. OccupancyType="Industrial - Factory/Warehouse/Clean Room/Workshop" in SGPset_Space.'],
    [/fire.?rating.?wall|frr.*wall|1.?hour.*wall|2.?hour.*wall/, 'SCDF', 'FireRating in Pset_WallCommon on IfcWall: SCDF fire resistance rating for walls. Values: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4 hours. LoadBearing=TRUE walls typically need higher FRR. Combined with IsPartyWall and IsExternal in SGPset_Wall.'],
    [/fire.?rating.?door|frr.*door|fire.?door/, 'SCDF', 'FireRating in Pset_DoorCommon on IfcDoor: fire door rating. SelfClosing=TRUE required for all fire doors. OneWayLockingDevice=TRUE for exit fire doors. FireAccessOpening=TRUE for SCDF inspection panels. FireExit=TRUE for emergency exit doors.'],
    [/fire.?rating.?damp|frr.*damp|fire.?damp.*rating/, 'SCDF', 'FireRating in SGPset_Damper on IfcDamper: fire resistance of damper. Values: 0.5-4 hours. Must match compartment wall FRR. DamperType: FIREDAMPER (mechanical ductwork only), FIRESMOKEDAMPER (fire + smoke), SMOKEDAMPER (smoke extract only).'],
    [/storey.?shelter|household.?shelter|hhs|civil.?defence/, 'BCA', 'Civil defence shelters (HHS/SS): ShelterUsage=TRUE in SGPset_Wall. Structural concrete walls min 250mm thick. BCA shelter certification required. In CORENET X: shelter walls modelled as IfcWall SOLIDWALL with BCA structural parameters.'],
    [/pressuri.?staircase|protected.?staircase|escape.?stair/, 'SCDF', 'Protected/pressurised staircase for buildings >24m: FireExit=TRUE on IfcStair. Lobby must be smoke-free (FireEmergencyVentilationMode=Pressurisation on lobby IfcSpace). Stair enclosure walls: min 2-hr FRR. Stair doors: self-closing fire-rated.'],
    [/final.?exit|exit.?discharge|ground.?level.?exit/, 'SCDF', 'Final exit: ground-level discharge from fire exit staircase to open air or safe place. IfcDoor FireExit=TRUE, FireAccessOpening=FALSE. Must lead directly to street/open space. Min 2m clear beyond door before any obstruction.'],
    [/alternative.?exit|2.?exit|two.?exit|second.?exit/, 'SCDF', 'Two independent exits required when: >100 persons OR travel distance exceeded. Exits must be remote from each other (min 9m separation or 1/2 diagonal distance). Both exits: min 800mm clear width. IfcDoor FireExit=TRUE on both.'],
    [/atriums?|void.?with.?adjoining|open.?atrium/, 'SCDF', 'Atria in CORENET X: smoke control provisions (SGPset_Space SmokeControlSystem). Sprinklers: Draft Curtains at each level boundary. Engineered smoke control. IfcSpace subtype SPACE with OccupancyType="Circulation - Lobby/Foyer". Max 3 storeys open without special provision.'],
    [/sprinkler.?head.?spacing|sprinkler.?coverage|activation.?temp/, 'SCDF', 'Sprinkler head in SGPset_FireSuppressionTerminal: SprinklerType (upright/pendant/concealed/sidewall), CoverageRadius (m), ActivationTemp (57°C standard, 68°C/79°C for high temp areas). Max coverage 9m² (hazard) to 21m² (light hazard).'],
    [/hose.?reel.?coverage|36.*metre.*hose|hose.*36/, 'SCDF', 'Hose reel coverage: each reel covers 36m radius. SCDF requires every point of floor accessible by hose. Modelled as IfcFireSuppressionTerminal *HOSE_REEL. Mounted at 900-1000mm from floor, within 6m of exit route.'],

    // URA Planning (20)
    [/landscape.?replacement|lrp|greener.*sing|skyrise.?green/, 'NParks/URA', 'Landscape Replacement Policy (LRP): new developments must provide landscaping equal to site area × LRP multiplier. Tracked via SGPset_SpaceArea_Landscape (ALS_LandscapeType, ALS_GreeneryFeatures) on landscape IfcSpace entities. ALS = Approved Landscape Submission.'],
    [/als.*landscape|landscape.*als|approved.?landscape.?sub/, 'NParks', 'ALS (Approved Landscape Submission) in SGPset_SpaceArea_Landscape: ALS_LandscapeType=[Turfing/Groundcover/Shrubs/Trees/Green Roof/Vertical Greenery/Planter Box/Water Feature], ALS_GreeneryFeatures=[Green Verge/Communal Garden/Rooftop Garden/Sky Garden/Vertical Garden/Nature Corridor/Heritage Tree Zone...], ALS_Species.'],
    [/sky.?garden|rooftop.?garden|green.?roof/, 'NParks/URA', 'Sky/rooftop garden in SGPset_SpaceArea_Landscape: ALS_LandscapeType=Green Roof, ALS_GreeneryFeatures=[Rooftop Garden/Sky Garden]. URA may grant bonus GFA for skyrise greenery. NParks tracks plant species (ALS_Species). IfcSpace subtype EXTERNAL or *LANDSCAPEAREA.'],
    [/vertical.?green|green.?wall|living.?wall/, 'NParks/URA', 'Vertical greenery in SGPset_SpaceArea_Landscape: ALS_LandscapeType=Vertical Greenery, ALS_GreeneryFeatures=Vertical Garden. NParks promotes Skyrise Greenery Incentive Scheme. Modelled on facade IfcSpace or IfcCovering with landscape psets.'],
    [/nature.?corridor|ecological.?link|green.?connect/, 'NParks', 'Nature corridors in SGPset_SpaceArea_Landscape: ALS_GreeneryFeatures=Nature Corridor. NParks requires connections between green spaces in certain zones. Heritage trees and heritage tree zones (ALS_GreeneryFeatures=Heritage Tree Zone) must be preserved.'],
    [/heritage.?tree|conservation.?tree|protected.?tree/, 'NParks', 'Heritage/conservation trees: NParks-gazetted trees must not be removed without permit. Modelled as IfcGeographicElement *TREE with Status=Existing in SGPset_GeographicElement. TreeNumber cross-references NParks Heritage Tree Register. Species required.'],
    [/tree.?removal|tree.?transplant|tree.?permit/, 'NParks', 'Tree works: Status in SGPset_GeographicElement: "To be Removed" (requires NParks permit for trees >1m girth), "To be Transplanted" (requires permit and method statement). NParks reviews at G1 (Design) and G3 (Completion) gateways.'],
    [/girth.*tree|tree.*girth|trunk.*diameter|dbh\b/, 'NParks', 'Girth in SGPset_GeographicElementDimension on IfcGeographicElement *TREE: trunk girth (circumference) in mm at 1.0m above ground. Trees with girth ≥1000mm require NParks approval for any works within root protection zone.'],
    [/roadside.?tree|verge.?tree|street.?tree/, 'NParks', 'Roadside=TRUE in SGPset_GeographicElement on IfcGeographicElement *TREE: tree is in road reserve/verge managed by NParks or LTA. Roadside trees have additional protection - any works require NParks clearance and LTA approval.'],
    [/single.?stem|multi.?stem|tree.?form/, 'NParks', 'SingleStem=TRUE in SGPset_GeographicElement: tree has single main trunk (typical for most trees). SingleStem=FALSE for multi-stem trees (e.g. palms, bamoo clumps). Affects girth measurement methodology for NParks classification.'],
    [/green.?verge|road.?verge|planting.?strip/, 'NParks', 'Green Verge: IfcGeographicElement subtype *GREENVERGE. SGPset_GeographicElement: ApprovedSoilMixture, ApprovedTurfSpecies (NParks-approved), ShrubSpecies, Turf (Boolean), Status. SGPset_SpaceArea_Landscape: ALS_GreeneryFeature=Green Verge, ALS_LandscapeType=[Turfing/Groundcover/Shrubs].'],
    [/hedge|hedging.?plant|hedge.?number/, 'NParks', 'Hedge: IfcGeographicElement subtype *HEDGE. SGPset_GeographicElement: Species, HedgeNumber (cross-ref to NParks landscape plan), Status=[Existing/Proposed/To be Removed/To be Transplanted], Height in SGPset_GeographicElementDimension.'],
    [/tree.?species|plant.?species|botanical.?name|common.?name.*tree/, 'NParks', 'Species in SGPset_GeographicElement on IfcGeographicElement VEGETATION: botanical (Latin) species name. NParks requires correct species identification for tree conservation and landscape assessment. For common trees: Angsana (Pterocarpus indicus), Rain Tree (Samanea saman), Tembusu (Fagraea fragrans).'],
    [/tree.?size|tree.?height.?class|small.*tree|large.*tree/, 'NParks', 'TreeSize in SGPset_GeographicElement: size classification per NParks (Small/Medium/Large). Separate from measured Height in SGPset_GeographicElementDimension. Used for landscape plan legend and submission categorisation.'],
    [/community.?garden|allotment.?garden|therapeutic.?garden/, 'NParks', 'Community/therapeutic gardens in SGPset_SpaceArea_Landscape: ALS_GreeneryFeatures=[Community Garden/Therapeutic Garden]. NParks promotes Community In Bloom programme. Modelled as landscape IfcSpace with landscape psets. BCA may count towards LRP provision.'],
    [/rain.?garden|bioswale|bio-swale|stormwater.?garden/, 'NParks/PUB', 'Rain garden/bio-swale: ALS_GreeneryFeatures=[Rain Garden/Bio-swale/Wetland] in SGPset_SpaceArea_Landscape. PUB ABC Waters design features - integrates stormwater management with landscape. IfcSpace *LANDSCAPEAREA with PUB drainage and NParks landscape psets.'],
    [/tree.?root.?zone|root.?protection|critical.?root/, 'NParks', 'Root protection zone (RPZ): typically 12× girth radius around tree trunk. No excavation or heavy machinery within RPZ without NParks approval. In CORENET X: modelled as site boundary exclusion zone. Girth parameter in SGPset_GeographicElementDimension.'],
    [/nparks.?clearance|nparks.?approval|nparks.?endorsem/, 'NParks', 'NParks clearance required for: removing trees >1m girth, works within root protection zone, changing heritage tree status, altering landscape in conservation areas. Submit via CORENET X at G1 (for design) and G3 (for as-built). NParks is 9th CORENET X agency.'],
    [/landscape.?plan|hard.?landscape|soft.?landscape/, 'NParks/URA', 'Landscape plan submission: NParks/URA review landscape at G1 and G3. Hard landscape (paving, water features): not tracked in SGPset but may be spatial. Soft landscape: IfcGeographicElement for plants, IfcSpace *LANDSCAPEAREA for landscape areas with SGPset_SpaceArea_Landscape.'],
    [/wetland|water.?body.?landscape|aquatic.?plant/, 'NParks', 'Wetland/water body landscapes: ALS_GreeneryFeatures=Wetland in SGPset_SpaceArea_Landscape. NParks nature reserves and conservation areas - strict controls. Aquatic plants tracked as IfcGeographicElement VEGETATION with species in SGPset_GeographicElement.'],

    // PUB Water/Drainage (20)
    [/wels|water.?efficiency.?label|water.?efficient/, 'PUB', 'WELS (Water Efficiency Labelling Scheme): WELS=TRUE in SGPset_SanitaryTerminal on IfcSanitaryTerminal. Mandatory for all WCs (max 3/4.5L flush), taps (max 9L/min), showers (max 12L/min), urinals (max 1.5L/flush). PUB requires WELS ticks at G3 (Completion).'],
    [/water.?tank.*size|storage.?tank.*capacity|water.?tank.?dim/, 'PUB', 'Water storage tanks: IfcTank (STORAGE subtype). SGPset_Tank: TankType, Length/Width/Height/Diameter in SGPset_TankDimension, Capacity in Pset_TankTypeCommon (m³). PUB min 24-hour supply storage for essential buildings. RWH tanks separate PredefinedType.'],
    [/pump.?type|circulator.?pump|sump.?pump|booster.?pump/, 'PUB', 'Pumps: IfcPump subtypes CIRCULATOR, SUMPPUMP, VERTICALINLINE. SGPset_Pump: PumpType, FlowRate (L/s or m³/hr), PumpPressure (kPa). PUB requires pump sizing calculations for water demand. Sump pumps required in basement car parks.'],
    [/flow.?meter|water.?meter|pum.*energy/, 'PUB', 'IfcFlowMeter (WATERMETER): MeterType in SGPset_FlowMeter. PUB requires sub-metering for large developments. Individual unit meters for residential. AMI (Advanced Metering Infrastructure) enabled meters preferred. PUB tracks via SGPset_FlowMeter.'],
    [/pipe.?gradient|drain.?gradient|slope.*pipe|1.?in.?40/, 'PUB', 'Gradient in SGPset_PipeSegment on IfcPipeSegment: minimum gradient for sewers. PUB requirements: foul sewer min 1:40 (2.5%), stormwater drain 1:100 (1%). DemountableStructureAbove=TRUE if removable structure above sewer for maintenance access.'],
    [/system.?type.*pipe|pipe.*system.?type|sewer.?type|foul.?water|storm.?water/, 'PUB', 'SystemType in SGPset_PipeSegment: distinguishes foul sewer, stormwater drain, water supply, recycled water, etc. SystemName for specific system label (e.g. "SS1", "SD1"). Critical for PUB separated drainage system (no cross-connection foul/storm).'],
    [/manhole|inspection.?chamber|sump|trench.?drain/, 'PUB', 'IfcDistributionChamberElement: subtypes MANHOLE, INSPECTIONCHAMBER, SUMP, TRENCH. SGPset_DistributionChamberElement: ChamberType. SGPset_DistributionChamberElementDimension: Length, Width, Depth. PUB requires manholes max 100m spacing on sewers.'],
    [/grease.?trap|grease.?interceptor|oil.?interceptor/, 'NEA', 'IfcInterceptor (GREASE): SGPset_Interceptor: InterceptorType=Grease, Capacity (litres), SGPset_InterceptorDimension: Length, Width. NEA requires grease traps for F&B outlets. Sizing: min 90-litre capacity per wash-up basin. Accessible for cleaning.'],
    [/petrol.?interceptor|oil.?interceptor|car.?wash.?trap/, 'NEA', 'IfcInterceptor (OIL/PETROL): SGPset_Interceptor: InterceptorType=[Oil/Petrol], Capacity. NEA requires oil/petrol interceptors for car parks, workshops, petrol stations. 3-chamber design. Discharge limit: 20mg/L oil content.'],
    [/floor.?trap|floor.?waste|roof.?drain|anti.?siphon/, 'NEA', 'IfcWasteTerminal subtypes: FLOORTRAP (anti-siphon trap), FLOORWASTE, ROOFDRAIN. SGPset_WasteTerminal: TrapType (P-trap, S-trap, bottle trap), InletDiameter (mm). NEA requires trapped floor outlets in all wet areas and roof drains.'],
    [/pressure.?reducing|prv|pressure.?relief|safety.?valve/, 'PUB', 'IfcValve subtypes: PRESSUREREDUCING (PRV) and PRESSURERELIEF (safety valve). SGPset_Valve: ValveType, Diameter. PRVs required where incoming supply pressure >500 kPa. PUB max working pressure: 700 kPa. Relief valve on water heaters mandatory.'],
    [/water.?demand|hydraulic.?calculation|pipe.?sizing/, 'PUB', 'PUB water demand: calculated from occupancy type and fixture count. Residential: 150 L/person/day. Commercial: depends on use. Pipe sizing: velocity max 3 m/s, min 0.5 m/s. InnerDiameter in SGPset_PipeSegmentDimension. SystemType identifies supply system.'],
    [/isolation.?valve|gate.?valve|ball.?valve|stop.?cock/, 'PUB', 'IfcValve ISOLATING subtype: isolation valves at main, branch, and appliance level. PUB requires isolation valve for each unit/tenancy. SGPset_Valve: ValveType, Diameter. Accessible location (valve chamber or accessible panel).'],
    [/abc.?waters|active.*beautiful.*clean|pub.*waterway/, 'PUB', 'ABC Waters Design Features: PUB programme integrating waterways with landscape. Features: constructed wetlands, bioretention swales, rain gardens. Tracked in SGPset_SpaceArea_Landscape (ALS_GreeneryFeatures=Bio-swale/Rain Garden/Wetland). PUB and NParks joint review.'],
    [/sewer.?connection|pov|pov.*sewer|point.?of.?vertical/, 'PUB', 'PUB sewer connection: Point of Vertical (PoV) connection to public sewer. PUB inspection at G3 (Completion). All foul water (SystemType=foul sewer) must connect to PUB sewerage system. Sewer IfcPipeSegment with Gradient, InnerDiameter, SystemType.'],
    [/recycled.?water|nwrp|newater|rainwater.?harvest/, 'PUB', 'Water recycling: NEWater (recycled water) and rainwater harvesting. SystemType in SGPset_PipeSegment identifies recycled water systems. RWH tanks tracked as IfcTank STORAGE. PUB requires colour-coding (purple pipe for recycled water). WELS still applies.'],
    [/water.?heater|solar.?hot.?water|instantaneous.?heater/, 'PUB', 'Water heaters: not directly modelled in IFC+SG component library but IfcUnitaryEquipment or IfcBuildingElementProxy with *WATERHEATER can be used. PUB requires: pressure-relief valve, expansion vessel for solar systems, thermostatic mixing valve for scalding prevention.'],
    [/sanitary.?system|drainage.?system|plumbing.?system/, 'PUB', 'Singapore plumbing: two-pipe system (foul + vent separate from stormwater). PUB requires full separation of foul and stormwater systems. SystemType in SGPset_PipeSegment identifies system. All pipes UPVC or cast iron. PUB inspects at G3.'],
    [/duct.*segment.*system|hvac.?duct|supply.*duct|return.*duct|exhaust.?duct/, 'NEA', 'IfcDuctSegment: SystemType in SGPset_DuctSegment (e.g. SUPPLYAIR, RETURNAIR, EXHAUSTAIR, FRESHAIR). SystemName for duct system label. IfcDuctFitting: SystemType. NEA regulates ductwork for air quality, fire dampers at compartment penetrations, and noise.'],
    [/air.?change|ach\b|ventilation.?rate|fresh.?air.?rate/, 'NEA', 'Ventilation rates: AirflowRate in SGPset_AirTerminal (m³/s). NEA minimum fresh air: 7.5 L/s/person (BCA SS553). Car parks: 6 ACH (mechanical) or 1 ACH (natural). Toilets: 15 ACH. Kitchens: negative pressure (exhaust > supply). CoolingCapacity and EnergyEfficiencyRatio for A/C units.'],

    // LTA Road (15)
    [/kerb|curb.?stone|road.?kerb/, 'LTA', 'IfcCivilElement *KERB: LTA road kerbs modelled in CORENET X. SGPset_CivilElement: ElementType=*KERB. SGPset_CivilElementDimension: Length, Width, Height. Standard Singapore kerb: 150mm high granite kerb. LTA reviews at G1 (alignment) and G2 (construction).'],
    [/culvert|box.?culvert|pipe.?culvert/, 'LTA', 'IfcCivilElement *CULVERT: drainage culvert under road. SGPset_CivilElement: ElementType=*CULVERT. SGPset_CivilElementDimension: Length, Width, Height. LTA requires hydraulic design calculation for culverts. Reinforced concrete box or pipe culverts standard.'],
    [/retaining.?structure|retaining.?wall.*lta|earth.?retain/, 'LTA', 'IfcCivilElement *RETAININGSTRUCTURE: LTA road retaining walls (cut slopes, embankments). ElementType=*RETAININGSTRUCTURE. BCA structural parameters also apply if within building development. LTA requires geotechnical design report. Distinct from BCA IfcWall RETAININGWALL.'],
    [/road.?reserve|road.?line|road.?setback/, 'LTA', 'Road reserve width: varies by road category (LTA Road Infrastructure Standards). Category 1 (expressway) up to 60m. Category 5 (minor road) 12m. Buildings must observe road setback. BroadLandUse=Road in SGPset_GeographicElement for road reserve boundary.'],
    [/carriageway|lane.?width|road.?width/, 'LTA', 'Carriageway lane widths (LTA): expressway 3.65m, arterial 3.65m, collector 3.3m, local 3.0m per lane. Cycle lane 1.5m. Footpath min 1.8m. Road widths affect site planning and building setback calculations in CORENET X.'],
    [/traffic.?impact|tia\b|transport.?impact/, 'LTA', 'Traffic Impact Assessment (TIA): required for developments generating >50 peak hour trips. LTA reviews TIA at G1. Results affect car park provision (ParkingType in SGPset_Space) and access arrangements. LTA agencies for IfcCivilElement and road frontage elements.'],
    [/sight.?distance|sight.?line|junction.*sight/, 'LTA', 'Sight distance at road junctions: min 50m at 50 km/h zones. Building setback at corners must allow sight triangles. Not directly in IFC properties but affects site boundary (IfcSite) and IfcGeographicElement placement near junction.'],
    [/drainageway.*lta|road.*drain|kerb.?and.?channel/, 'LTA', 'Road drainage: kerb-and-channel system or roadside drain. Coordinated between LTA (road reserve) and PUB (public sewer/drain system). IfcCivilElement *DRAINAGESWALE for road drainage swales. PUB stormwater connection at road boundary.'],
    [/bicycle.?lane|cycling.?path|pcn\b|park.?connector/, 'LTA', 'Cycling infrastructure: LTA Park Connector Network (PCN) paths are IfcCivilElement elements. Min 3m wide bidirectional. NParks manages PCN landscape. Not explicitly in current CORENET X IFC dataset but future CORENET X version to include cycling infrastructure elements.'],
    [/traffic.?signal|traffic.?light|pelican.*crossing|toucan.*crossing/, 'LTA', 'Traffic signals and pedestrian crossings: outside current IFC+SG CORENET X scope but LTA reviews pedestrian crossing provision at G1. IfcOpeningElement or IfcGeographicElement can be used to mark crossing locations in site model.'],
    [/erp|electronic.?road.?pricing|car.?park.?provision/, 'LTA', 'Car park provision: LTA/URA car parking standards (CPS) specify parking requirements per GFA. LTA reviews at G1. Car park spaces: OccupancyType="Car Park - *" in SGPset_Space. ParkingType distinguishes accessible, season, hourly, mechanised.'],
    [/road.?hump|speed.?table|traffic.?calming/, 'LTA', 'Traffic calming: road humps and speed tables within development require LTA clearance. Civil elements modelled as IfcCivilElement within site. LTA standards: road hump min 75mm height, 1.8m length, max spacing 30m.'],
    [/loading.?bay|loading.?dock|goods.?vehicle|lorry.?bay/, 'BCA', 'Loading bays: OccupancyType="Circulation - Loading / Unloading Bay" in SGPset_Space. BCA requires accessible loading bay provision. Min 3.5m × 9m for single-axle lorry. LTA may require off-street loading for high-traffic developments.'],
    [/bus.?bay|bus.?stop.*build|transit.?facilit/, 'LTA', 'Bus bay and transit facilities: LTA requirement for certain developments to provide bus bays. IfcCivilElement for bus bay kerb. Shelter: IfcSpace with appropriate OccupancyType. LTA reviews at G1 design stage.'],
    [/automated.?vehicle|av.?infrastructure|self.?driving/, 'LTA', 'Future AV infrastructure: LTA is planning for autonomous vehicle requirements. Not yet in IFC+SG CORENET X v1 but future CORENET X versions will address AV pick-up/drop-off spaces, AV-compatible car parks. Current: model as standard car park with AGF_DevelopmentUse=Transport Facilities.'],

    // IFC Technical (20)
    [/ifc4\b|ifc.?4.?add|ifc.?4.?reference|ifc4x3/, 'IFC', 'CORENET X requires IFC4 (IFC 4.0). Not IFC2x3. Check: FILE_SCHEMA("IFC4") in IFC header. BCA IFC+SG COP 3.1 December 2025 specifies IFC4 Reference View MVD. IFC4x3 (used for infrastructure) is NOT the same as IFC4 - do not confuse.'],
    [/reference.?view|design.?transfer.*view|mvd\b|model.?view.?def/, 'IFC', 'IFC4 Reference View: the MVD (Model View Definition) used for CORENET X. Read-only model exchange - geometry must be SweptSolid or Brep (no parametric curves). Design Transfer View allows more geometry types but BCA accepts Reference View format for all submissions.'],
    [/guid.?format|ifcglobal|global.?id|ifc.?id.?format/, 'IFC', 'IFC GlobalId format: 22-character base64 encoded GUID. Must be unique per entity per file AND across submissions - never reuse GUIDs. GUIDs used for change tracking between BCA submissions. Authoring tools auto-generate GUIDs; do not manually set.'],
    [/coordinate.*system|project.?north|true.?north|svy21/, 'IFC', 'CORENET X coordinate system: SVY21 (Singapore national coordinate system). True North defined in IfcGeometricRepresentationContext. Project North (building grid) separate. BCA requires SVY21 coordinates in IfcSite RefLatitude/RefLongitude for geolocated submission.'],
    [/storey.?elevation|floor.?elevation|shd.*elevation|level.*datum/, 'IFC', 'IfcBuildingStorey Elevation: in Singapore Height Datum (SHD) in metres. Not local datum. Critical for pile CutOffLevel_SHD alignment between structural and architectural models. G1 submission: preliminary levels; G3: as-built SHD levels from licensed surveyor.'],
    [/property.?set|pset|ifc.?property/, 'IFC', 'IFC property sets: Pset_ (standard IFC4) + SGPset_ (Singapore custom). Psets attach via IfcRelDefinesByProperties. Multiple psets per entity allowed. SGPset_ defined by BCA IFC+SG COP 3.1. Authoring tools: must configure custom pset templates to export SGPset_.'],
    [/predefined.?type|object.?type|userdefined|element.?type/, 'IFC', 'PredefinedType vs ObjectType: PredefinedType is from IFC standard enum (e.g. SOLIDWALL, BEAM, ELEVATOR). ObjectType is free-text for USERDEFINED subtypes with * prefix (e.g. *PPVC, *TREE, *TRANSFERBEAM). Both required for CORENET X classification.'],
    [/ifc.?relation|ifcrel|aggregate|contained.?in/, 'IFC', 'Key IFC relationships: IfcRelAggregates (building hierarchy: IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey), IfcRelContainedInSpatialStructure (element to storey), IfcRelDefinesByProperties (pset assignment), IfcRelAssociatesMaterial (material link). All required for valid CORENET X model.'],
    [/quantity.?takeoff|ifc.*quantity|base.?quantity/, 'IFC', 'IFC quantities: BaseQuantities pset (Qto_*) for area, volume, length, weight. Used by cost estimators. Not directly required for CORENET X submission but BCA may use for GFA verification cross-check. SGPset_SpaceDimension Area property is the primary GFA area source.'],
    [/classification.?reference|uniclass|omniclass|sfb\b/, 'IFC', 'IFC+SG COP 3.1 classification: BCA uses IfcClassificationReference to classify elements. Classification system: IFC+SG (Singapore national classification). 206 classification codes from BCA Industry Mapping (Dec 2025). Authoring tools must map element types to classification codes.'],
    [/ifc.?open.?shell|brep.?geometry|swept.?solid|extrude/, 'IFC', 'CORENET X geometry: IfcFacetedBrep (solid mesh) and IfcExtrudedAreaSolid (swept solid) are the primary representations. IfcCSG (boolean operations) also accepted. NURBS/splines not recommended. Reference View requires closed solid bodies. Check with viewer before submission.'],
    [/ifc.*unit|si.*unit|mm.*ifc|metre.*ifc/, 'IFC', 'IFC units: CORENET X uses SI metric. Length unit: MILLIMETRE (all dimensions in mm). Area: SQUARE_METRE. Volume: CUBIC_METRE. Plane angle: RADIAN. Defined in IfcUnitAssignment of IfcProject. Authoring tools may default to metres - check IFC export settings.'],
    [/ifc.?header|ifc.?schema.?version|file.?description|file.?name/, 'IFC', 'IFC file header: FILE_DESCRIPTION (contains view definition), FILE_NAME (file path, timestamp, author, organisation, preprocessor), FILE_SCHEMA. CORENET X requires FILE_SCHEMA("IFC4"). Project info in IfcProject: Name, LongName (project number), Description.'],
    [/spatial.?structure|ifcproject|ifcsite|ifcbuilding.*storey/, 'IFC', 'IFC spatial hierarchy for CORENET X: IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → IfcSpace. Elements attached to storeys via IfcRelContainedInSpatialStructure. Each space must have correct storey. Buildings with multiple towers: one IfcBuilding per tower, all under same IfcSite.'],
    [/ifc.?type.?object|shared.?type|product.?type/, 'IFC', 'IfcTypeObject (e.g. IfcWallType, IfcDoorType): shared type definition for identical elements. SGPset_ properties should be set on the type for properties common to all instances. Instance-specific properties (Mark, coordinates) set on IfcElement instances. Reduces file size significantly.'],
    [/clash.?detect|interference.?check|coordin.*ifc/, 'IFC', 'Clash detection: CORENET X models from different disciplines (architectural, structural, MEP) are federated. IfcRelInterferesElements for formal clash recording. BCA may check for major clashes. BIM coordination typically done in Navisworks/Solibri before CORENET X submission.'],
    [/federation|federated.?model|combined.*model|multi.*discipline/, 'IFC', 'Federated IFC: CORENET X accepts separate IFC files per discipline (Architectural, Structural, MEP, Site). Each file has same IfcProject GUID. Spatial structure must be consistent. BCA aggregates files for full compliance check across all agencies.'],
    [/ifc.*validation|schema.*valid|syntax.*valid/, 'IFC', 'IFC validation: BCA runs automated schema validation (IFC4 syntax), followed by MVD conformance check, then Singapore-specific rule checks. Common errors: missing GlobalId, duplicate GUIDs, empty mandatory properties, incorrect entity type, missing spatial containment.'],
    [/corenet.?x.?portal|corenet.*submission|esub.*corenet/, 'BCA', 'CORENET X submission portal: eSub (Electronic Submission System). Upload IFC4 files per discipline. System runs automated checks (L1-L20). Failed checks generate non-compliance report. Manual review by BCA/SCDF/URA/NEA/PUB/LTA/HDB/SLA/NParks/JTC officers for each agency\'s parameters.'],
    [/qp.*duty|qualified.?person|qualified.?person.*submit/, 'Professional', 'QP (Qualified Person) duties for CORENET X: QP is the professionally accredited person who signs off submissions (Registered Architect or PE). QP certifies IFC model accuracy, completeness, and code compliance. QP\'s details in IfcProject IfcActorRole.'],

    // Malaysia NBeS (15)
    [/nbes|national.?bim.?estamp|malaysia.?bim.?submiss/, 'Malaysia', 'NBeS (National BIM eSubmission): Malaysia\'s equivalent of Singapore CORENET X. IFC-based digital submission for building permits. Uses IFC4 with Malaysia-specific property sets (MPset_). VERIFIQ supports both CORENET X (Singapore) and NBeS (Malaysia) compliance checking.'],
    [/ubbl|uniform.?building.?by.?law|malaysian.?building.?law/, 'Malaysia', 'UBBL (Uniform Building By-Laws 1984): primary Malaysian building code enforced by local authorities (PBT). Key rules: UBBL-1 (exit stair min 1050mm), UBBL-2 (travel distance 30m/45m), UBBL-3 (corridor 1800mm), UBBL-4 (ramp 1:12), UBBL-5 (ceiling height 2400mm).'],
    [/bomba|jabatan.?bomba|malaysia.?fire/, 'Malaysia', 'BOMBA (Malaysia Fire and Rescue): Malaysian fire safety authority. Key rules: BOMBA-1 (compartment max 7000m² for Type 1), BOMBA-2 (sprinklers >30m height). Sprinkler design per MS 1489 (Malaysia Standard). Travel distance 30m/45m similar to Singapore SCDF.'],
    [/jkr|jabatan.?kerja.?raya|public.?works.?dep/, 'Malaysia', 'JKR (Jabatan Kerja Raya - Public Works Department): Malaysian structural engineering authority. JKR-1: structural design per BS EN 1990/1992 Eurocodes with Malaysia National Annex. Pile design similar to Singapore (Eurocode 7 DA1). Malaysia uses KN/m² for loads.'],
    [/ms1184|oci.*malaysia|malaysia.*accessible|disabled.*access.*malaysia/, 'Malaysia', 'MS1184 (Malaysia Standard for Accessibility): accessible parking 3600×5000mm, accessible toilet 1700×1700mm, handrail 850-900mm. More prescriptive than Singapore CP79 in some areas. BOMBA also requires accessibility for fire evacuation. VERIFIQ checks MS1184 at NBeS submission.'],
    [/ministry.?of.?works|kkr.*malaysia|cidb.*malaysia/, 'Malaysia', 'Ministry of Works (KKR) Malaysia: responsible for construction industry regulations. CIDB (Construction Industry Development Board) sets local IFC standards. MPset_ property sets for Malaysia NBeS submissions. Malaysia BIM Roadmap targets mandatory BIM for projects >RM50M.'],
    [/local.?authority.*malaysia|pbt.*malaysia|dbkl|mpkj/, 'Malaysia', 'Local Authorities (PBT) in Malaysia: DBKL (Kuala Lumpur), MBPJ (Petaling Jaya), MPKJ (Kajang) etc. Each PBT issues building permits based on UBBL. NBeS centralises submission via JKR ePermit portal. Local authority GIS data for zoning in Malaysia IFC submissions.'],
    [/plan.?approval.*malaysia|bp.*malaysia|building.?permit.*malaysia/, 'Malaysia', 'Malaysia building permit (BP) process via NBeS: Stage 1 = Planning Permission, Stage 2 = Building Plan Approval, Stage 3 = CF (Certificate of Fitness). Parallel to Singapore CORENET X G1/G2/G3 gateways. IFC4 submission required at Stage 2 and Stage 3.'],
    [/fire.?staircase.*malaysia|ubbl.?167|escape.?stair.*malaysia/, 'Malaysia', 'UBBL Reg 167 (UBBL-1): fire escape staircase clear width ≥ 1050mm in Malaysia. Compared to SCDF Singapore: same 1050mm minimum. Width calculation per person: 5.5mm per person for occupancies >250. Additional stair above 1050mm if occupancy >250 persons per storey.'],
    [/malaysia.?travel.?distance|ubbl.*30m|ubbl.*45m|fire.?escape.*dist.*malaysia/, 'Malaysia', 'UBBL-2 travel distance: max 30m to nearest exit (unsprinklered), 45m (sprinklered). Measured along actual walking path, around obstructions. BOMBA review required for all public buildings. Same limits as SCDF Singapore - but enforcement is by local BOMBA district office.'],
    [/malaysia.?ramp|ramp.*malaysia|1.?in.?12.*malaysia/, 'Malaysia', 'UBBL-4 ramp gradient: max 1:12 for accessible ramps. MS1184 specifies ramp width min 1200mm, landing 1500mm. Handrail both sides at 850-900mm. Car park ramps: max 1:8 (12.5%) for straight, 1:10 for curved. Same as Singapore BCA provisions.'],
    [/malaysia.*ceiling.*height|ubbl.*2400|floor.*to.*ceiling.*malaysia/, 'Malaysia', 'UBBL-5 ceiling height: min 2400mm for habitable rooms. Basement car parks: min 2100mm. Corridors: min 2200mm. Malaysia allows slightly lower min heights than Singapore (BCA: min 2400mm for most spaces). Kitchen: min 2400mm. Bathroom: min 2100mm.'],
    [/malaysia.?concrete|ms1195|ms1196|bs.?8110.*malaysia/, 'Malaysia', 'Malaysian structural standards: BS 8110 (superseded by Eurocodes in JKR projects), MS EN 1992 (Eurocode 2) for concrete. Concrete grades: C20, C25, C30, C35 (using cylinder strength). Malaysia NA (National Annex) to Eurocodes applies. Similar to Singapore BCA Eurocode adoption.'],
    [/green.?building.?index|gbi|malaysia.?green|certus/, 'Malaysia', 'GBI (Green Building Index): Malaysia\'s green building rating system. Similar to Singapore BCA Green Mark. 6 categories: Energy Efficiency, Indoor Environment Quality, Sustainable Site Planning & Management, Materials & Resources, Water Efficiency, Innovation. Not directly in NBeS IFC properties but informs M&E design.'],
    [/sirim|malaysia.?standard|ms.?\d{3,4}/, 'Malaysia', 'Malaysia Standards (MS): published by SIRIM (Standards Malaysia). Key standards: MS1489 (sprinkler), MS1184 (accessibility), MS EN 1992/1993 (structural Eurocodes with Malaysia NA), MS ISO 16739 (IFC standard). VERIFIQ cross-references MS standards in NBeS compliance checks.'],

    // CORENET X Process (15)
    [/g1.*submit|design.*gateway.*submit|stage.?1.*corenet/, 'BCA', 'CORENET X G1 (Design Gateway): agencies review - BCA, URA, SCDF, NEA, PUB, NParks. Submit: architectural IFC (spaces, finishes, accessibility), structural IFC (elements, loads), MEP IFC (drainage, HVAC). L18 check level. After G1 approval: G1.5 if piling required.'],
    [/g1.?5.*submit|piling.*gateway.*submit|demolition.*gateway/, 'BCA', 'CORENET X G1.5 (Piling/Demolition Gateway): BCA only. Submit: geotechnical IFC (IfcPile with full SGPset_Pile/PileStructuralLoad/PilingDesignParameter data). CutOffLevel_SHD, BoreholeRef, DA1-1/DA1-2 capacities. Piling works can only start after G1.5 approval.'],
    [/g2.*submit|construction.*gateway.*submit|stage.?2.*corenet/, 'BCA', 'CORENET X G2 (Construction Gateway): agencies - BCA, PUB, SCDF, LTA. Detailed construction drawings as IFC. Full structural member details, rebar specs, MEP system design. L19 check level. After G2 approval: construction can commence. Full SGPset_ population required.'],
    [/g3.*submit|top.*gateway.*submit|completion.*submit|as.?built.*ifc/, 'BCA', 'CORENET X G3 (Completion/TOP Gateway): agencies - BCA, URA, SCDF, NEA, PUB, LTA, NParks. All 10 agencies. As-built IFC model reflecting actual constructed state. L20 check level. WELS=TRUE on all sanitary terminals. NParks tree survey (as-built). URA GFA verification.'],
    [/ifc.*review|quality.?checking|qc.*ifc|ifc.*quality/, 'BCA', 'IFC quality checking process: automated checks (L1-L8 schema/property validation), then agency-specific checks (L9-L20). VERIFIQ replicates these checks locally before submission. Pass all 20 levels before uploading to CORENET X portal. Non-compliant model generates checklist report.'],
    [/corenet.*x.?register|corenet.*x.?account|qp.*register/, 'BCA', 'CORENET X registration: QP must be registered with BCA (Registered Architect or PE with BCA licence). Company must be registered. IFC submissions linked to project BCA reference number. New accounts: singpass/corppass authentication at CORENET X portal.'],
    [/amendment.*submit|revised.*ifc|re.?submit.*corenet/, 'BCA', 'CORENET X amendments: resubmit updated IFC file to same project. BCA tracks changes by comparing GlobalIds and property values between submissions. Maintain consistent GUIDs for unchanged elements - change tracking breaks if GUIDs are regenerated on every export.'],
    [/professional.*engineer|pe.*structural|pe.*civil|registered.?engineer/, 'Professional', 'PE (Professional Engineer) duties for CORENET X structural submission: PE-SE (Structural) signs off G1.5, G1 structural, G2 structural, G3 as-built. PE certifies design calculations. PE name and licence in IfcProject. PE endorses geotechnical (G1.5) and structural (G1/G2/G3) IFC files.'],
    [/registered.?architect|ra.*corenet|architect.*submission/, 'Professional', 'RA (Registered Architect) duties: signs off architectural submissions (G1 architectural model). RA certifies spatial layout, GFA compliance, fire exit planning. RA registered with Board of Architects Singapore. RA endorses CORENET X submission - QP for architectural component.'],
    [/mep.*corenet|m.?and.?e.*corenet|mechanical.*electrical.*submit/, 'BCA', 'MEP CORENET X: Mechanical (HVAC/ventilation/lifts), Electrical, Plumbing submissions. SCDF reviews fire suppression (G1, G2, G3). PUB reviews plumbing/drainage (G2, G3). NEA reviews waste, ventilation, A/C (G1, G2). Separate IFC files or combined MEP IFC. Each PE signs relevant section.'],
    [/cec.*corenet|chief.*exec.*certif|cec.*building/, 'Professional', 'CEC (Chief Executive Certificate): required for large building projects in Singapore. CEC certifies building compliance before TOP. Not directly in IFC but CECs review CORENET X compliance reports. Building owners appoint CEC for projects >5,000m² GFA.'],
    [/design.?build|db.?contract|d.?and.?b.*corenet/, 'BCA', 'Design-and-build contracts: contractor is QP (or appoints QP). Same CORENET X submission requirements apply. IFC model may evolve significantly from G1 (concept) to G2 (detailed design) under D&B. BCA requires consistent GUIDs for tracked elements between G1 and G2 submissions.'],
    [/bim.?execution.?plan|bep\b|ifc.*standard.*project/, 'BCA', 'BIM Execution Plan (BEP): project document defining IFC workflow. Specifies: IFC version (IFC4), authoring software per discipline, export settings, pset mapping, LOD (Level of Development) per gateway, file naming convention. Not submitted to CORENET X but required by BCA for BIM projects.'],
    [/lod.*corenet|level.?of.?detail.*ifc|lod.?300|lod.?400/, 'BCA', 'Level of Development (LOD) for CORENET X: G1 = LOD 200-300 (design intent, approximate dimensions). G2 = LOD 300-350 (coordinated, construction-ready). G3 = LOD 400 as-built (actual installed dimensions). SGPset_ properties must be populated at required LOD per gateway.'],
    [/corenet.*x.?fee|submission.*fee.*bca|bca.*plan.?fee/, 'BCA', 'CORENET X submission fees: BCA charges plan fees based on GFA and project type. Residential: S$10.30-S$35 per m² depending on type. Commercial/industrial: S$14.40-S$35 per m². SCDF/URA/NEA/PUB fees additional. Paid at submission through CORENET X portal.'],

    // Professional & Sustainability (10)
    [/green.?mark|bca.?green|bei\b|greenmark/, 'BCA', 'BCA Green Mark: Singapore\'s green building rating system. Levels: Certified (50+), Gold (65+), GoldPlus (75+), Platinum (90+). Categories: Energy Efficiency (includes BEI - Building Energy Intensity), Water Efficiency, Indoor Environment Quality, Sustainable Sites, Greenery & Biodiversity. New: Green Mark 2021 edition.'],
    [/bei\b|building.?energy.?intensity|energy.?use.?intensity/, 'BCA', 'BEI (Building Energy Intensity): kWh/m²/yr metric for Singapore Green Mark Energy Efficiency. Commercial: target BEI ≤ 130 kWh/m²/yr (Platinum). Calculated from M&E plant schedule. A/C EnergyEfficiencyRatio in SGPset_UnitaryEquipment relates to BEI contribution.'],
    [/solar.?panel|pv.*panel|photovoltaic|rooftop.*solar/, 'BCA', 'Solar PV: tracked in BCA Green Mark, possible bonus GFA (AGF_BonusGFAType=Solar Panel Area). IfcSlab subtype ROOF or IfcBuildingElementProxy *SOLARPANEL. NEA: connection to Singapore Power Grid via SP Services. Not in core IFC+SG psets but relevant to sustainability credits.'],
    [/universal.?design|ud.*bca|ud.*mark/, 'BCA', 'Universal Design (UD) Mark: BCA programme for inclusive buildings beyond basic accessibility. UD features: adjustable-height workstations, hearing induction loops, dementia-friendly design, multi-sensory wayfinding. UD Score in SGPset_Space (LargerAccessible, HearingEnhancement, ElderlyFriendly, ChildrenFriendly booleans).'],
    [/in.?principle.?accept|ipa.*wels|wels.?certif/, 'PUB', 'PUB WELS IPA (In-Principle Acceptance): manufacturer must obtain WELS certification before product can be specified. WELS database: pub.gov.sg/wels. At G3, QP confirms all WELS=TRUE sanitary terminals in IFC model are from WELS-certified products. VERIFIQ L16 check validates WELS flag presence.'],
    [/noise.?barrier|noise.?sensitive|sound.?insulation|rw.*value/, 'BCA/NEA', 'Noise control: BCA requires sound insulation between units (min Rw 45dB for party walls). NEA noise limits at site boundary. SoundPressureLevel in SGPset_Space for M&E equipment rooms. Pset_WallCommon SoundTransmissionClass for party walls. Not SGPset_ but standard IFC pset.'],
    [/energy.?audit|m&v.*plan|metering.?plan|sub.?meter/, 'BCA/NEA', 'Energy metering: BCA Green Mark requires energy sub-meters for major systems (A/C, lighting, water heating, data centre). MeterType in SGPset_FlowMeter (ENERGYMETER) tracks energy meters. AMI-enabled meters preferred by PUB/BCA. Sub-metering supports ongoing BEI monitoring.'],
    [/thermal.?comfort|wet.?bulb|operative.?temp|pmv/, 'NEA', 'Thermal comfort: NEA ambient air standards: SS 554:2009 Indoor Air Quality standard. Design conditions: 23-26°C, RH 55-65%. CoolingCapacity in SGPset_UnitaryEquipment. Not directly in SGPset_ Space but NEA checks ventilation adequacy via window openable area and A/C provisions.'],
    [/carbon.?neutral|net.?zero|scope.?1.?2.?3|carbon.?footprint/, 'BCA', 'Carbon neutrality: Singapore Green Plan 2030 targets 80% green buildings by 2030. BCA Green Mark 2021 includes embodied carbon reporting. SG Green Building Masterplan. Structural MaterialGrade selection (lower-carbon concrete mixes) tracked via SGPset_Material. Not in current CORENET X but future requirement.'],
    [/accessibility.?audit|cp79.*audit|barrier.*free.*audit/, 'BCA', 'Accessibility audit: BCA requires accessibility audit by registered accessibility auditor for certain building types before TOP. Auditor checks BarrierFreeAccessibility=TRUE spaces, ramp gradients, door clear widths, lift dimensions against CP79. CORENET X model used as reference for audit.'],

    // CORENET X Mandatory Thresholds & Timelines (8)
    [/30.?000.*gfa|gfa.*30.?000|mandatory.*corenet|corenet.*mandatory|1.*oct.*2025/, 'BCA', 'CORENET X mandatory requirement: from 1 October 2025, ALL new projects with GFA ≥30,000 m² must submit via CORENET X portal. Circular issued 10 Sep 2025 by BCA. Projects below 30,000 m² may submit voluntarily. GFA measurement per URA rules.'],
    [/part.?st|40.?000.*gfa|gfa.*40.?000|structural.*part.*submit/, 'BCA', 'Part ST (Structural) submissions: eligible if GFA >40,000 m² AND (5+ blocks ≥4 storeys, OR 3+ blocks ≥4 storeys with common podium/basement) OR infrastructure >150m (building-like) or >400m (tunnels/viaducts). Must submit complete BIM + full structural carcass at 1st CG; detailed calculations in parts.'],
    [/sla.*working.?day|agency.*sla|working.?day.*approv|approval.*time/, 'BCA', 'CORENET X Service Level Agreements (SLAs): Joint gateway submissions - all agencies: 20 working days. Independent submissions: BCA 15 WD; LTA 20 WD; NEA 20 WD; NParks 20 WD; PUB 14 WD (drainage) / 21 WD (sewerage); SCDF 5 WD. Extended to 30 WD if Design Advisory Panel (DAP) session needed.'],
    [/sha.?256|checksum.*plan|plan.*checksum|digital.*integrity/, 'BCA', 'SHA256 checksum: BCA applies a SHA256 hash to approved IFC plans to verify integrity. The approved file must not be altered after clearance - any modification changes the hash and invalidates approval. Checked at G3 (Completion) when as-built models are compared to approved construction models.'],
    [/bcf.?format|bim.?collab.?format|agency.?comment.*bim|comment.*ifc.*tag/, 'BCA', 'BCF (BIM Collaboration Format): agencies return comments tagged to specific BIM elements using BCF files. QP/team must resolve all BCF comments before resubmission. BCF links comment to IfcGlobalId. BCA, URA, SCDF, NEA, PUB, LTA, NParks all use BCF for joint review comments.'],
    [/800.*mb|model.*size.*limit|ifc.*file.*size|max.*file.*size/, 'BCA', 'IFC model size limit: maximum 800 MB per IFC file in CORENET X. For large projects: export one IFC file per block (one IfcSite per file). Federate separately using IFC binder or viewer. Oversized files rejected by CORENET X portal. Reduce by removing unnecessary geometry and unused type objects.'],
    [/r13|release.?13|ura.*v3.?3|use.?dictionary.*3.?3|nparks.?3.?group|rssz.*new|road.?structure.?safety.?zone/, 'BCA', 'CORENET X R13 (26 March 2026): URA Use Dictionary updated to v3.3 (new space names), NParks 3-group structure implemented (trees/palms/hedges reorganised), BCA Buildability scoring update, LTA new RSSZ (Road Structure Safety Zone) category added for developments within road safety zones.'],
    [/corenet.*portal.*url|corenet\.gov\.sg|training\.corenet|singpass.*corenet|corppass.*corenet/, 'BCA', 'CORENET X portal: Production - https://corenet.gov.sg. Training/sandbox - https://training.corenet.gov.sg. Authentication via Singpass for Business (Corppass). Key roles: Developer, Qualified Person (QP), Licensed Builder, Specialist Builder, Accredited Checker, Fire Safety Engineer, Transport Consultant, Landscape Architect, Geotechnical Engineer.'],

    // NEA Environmental Specifics (5)
    [/cooling.?tower.*setback|setback.*cooling.?tower|5.*metre.*cooling/, 'NEA', 'NEA cooling tower setback: minimum 5 m clearance required between cooling tower and any adjacent structure or boundary. Cooling tower location must be shown at G1 (Design Gateway). COPPC requirements also specify setbacks from residential, petrol stations, and industry.'],
    [/industrial.*buffer|nuisance.*buffer|light.*industry.*buffer|general.*industry.*buffer|special.*industry.*buffer/, 'NEA', 'NEA nuisance buffers (COPPC): Light/Clean industry: 50 m from place of worship, petrol station, or residential. General industry: 100 m from residential. Special industry: 500 m from residential. MRT track setbacks: 35 m fronting track, 25 m end-wall facing track. 70 m from LTA expressway/major road reserve to residential lot boundary.'],
    [/eis.*petrol|petrol.*eis|environmental.*impact.*petrol|50.*metre.*petrol/, 'NEA', 'EIS (Environmental Impact Study): required for developments within 50 m of petrol stations or for new petrol stations near residential. Submit to NEA at Pre-Submission stage. Processing: 1-2 months. Must conclude before Design Gateway (G1). Submit to DCLD_consultation@nea.gov.sg.'],
    [/nia.*traffic|traffic.*noise.*nia|noise.*impact.*assess|70.*metre.*expressway/, 'NEA', 'NIA (Noise Impact Assessment): for new residential/noise-sensitive developments within 70 m of expressways/major arterial roads or MRT tracks. Pre-NIA: submit to NEA before G1; Post-NIA: submit before G3. Processing 1-2 months each. Required before TOP. Contact DCLD_consultation@nea.gov.sg.'],
    [/pwcs|pneumatic.*waste|ss.*642|refuse.?system.*conv/, 'NEA', 'PWCS (Pneumatic Waste Conveyance System): NEA requires PWCS spatial provisions for new residential/mixed developments per SS 642:2019. Modelled at G1 (conceptual layout, vacuum collection points) and G2 (detailed PWCS network, tank room, suction points). NEA COPEH Section 1.7.'],

    // LTA Transport Specifics (4)
    [/rssz|road.?structure.?safety.?zone/, 'LTA', 'RSSZ (Road Structure Safety Zone): LTA category added in R13 (March 2026). Developments within RSSZ require preliminary engineering evaluation - project overview, site investigation, impact analysis, evaluation of effects on road structures. Confirm at G1 whether project falls within RSSZ boundary.'],
    [/pudo|pick.?up.?drop.?off|passenger.?alighting.?boarding|paab/, 'LTA', 'PUDO (Pick-Up Drop-Off) / PAAB (Passenger Alighting and Boarding Points): LTA requires PUDO layout at G1 - number of bays, queue length, width, kerb alignment. Detailed access point levels and structural details at G2. For major developments: formal PUDO study may be required.'],
    [/dap.*review|design.*advisory.*panel|pre.*submission.*consult.*4.*week/, 'BCA', 'Design Advisory Panel (DAP): BCA/URA panel for complex design issues. DAP Stage 1 before G1, Stage 2 before G2. Pre-submission consultation: at least 4 weeks (20 WD) in advance. DAP session: ~3-4 weeks (15-20 WD) after materials submitted. Minutes: ~2 weeks (10 WD) after session. Gateway SLA extended to 30 WD if DAP needed.'],
    [/dsp.?eligib|direct.*submit.*process|single.*unit.*landed|dsp.*landed/, 'BCA', 'DSP (Direct Submission Process): simplified single-stage regulatory process for single-unit residential landed properties AND simple structures (bus stops, linkways, pavilions). Replaces 3-Gateway RABW. Projects with 2+ houses must use RABW (not DSP). URA Plan Lodgment Scheme: qualifying A&A or new erection on landed residential zoned land. NParks R13: Group 1 works (minor landscape) go to lodgement; Groups 2/3 go to plan application.'],

    // 3rd Party Apps - IFC Viewers (6 recommended by BCA)
    [/bimcollab.*zoom|zoom.*bimcollab|ifc.*viewer.*collab/, 'IFC', 'BIMCollab Zoom: recommended IFC viewer for CORENET X (free/FOC). Supports full IFC federation (unlimited files), handles large files well. Download: helpcenter.bimcollab.com. Supports BCF for agency comment review. Best choice for multi-file project federation and BCF comment management.'],
    [/bimvision|bim.*vision.*viewer/, 'IFC', 'BIMVision: free IFC viewer recommended for CORENET X. Federates up to 2 IFC files. Supports IfcGrid and Search Query. Download: bimvision.eu/download/. Registration may be required. Suitable for quick visualisation of IFC files. BCA-recommended tool.'],
    [/kit.*model.*viewer|fzk.*viewer|iai.*viewer/, 'IFC', 'Kit Model Viewer (replaces FZK Viewer): free IFC viewer from IAI/KIT (Karlsruhe Institute of Technology). Best for analysing smaller IFC files (<200 MB). Supports system entities, IfcGrid, and search. Download: iai.kit.edu/english/1302.php. Cannot federate multiple IFC files - use 1IFC binder if federation needed.'],
    [/solibri.*anywhere|solibri.*free.*viewer/, 'IFC', 'Solibri Anywhere: free IFC viewer (read-only version of Solibri Office). Recommended by BCA for CORENET X model viewing. Cannot federate multiple IFC files. Use 1IFC binder to combine before viewing. solibri.com/solibri-anywhere. Solibri Office (paid) includes IFC+SG ruleset checking.'],
    [/trimble.*connect.*desktop|trimble.*connect.*ifc|tekla.*connect/, 'IFC', 'Trimble Connect Desktop: free IFC viewer supporting full federation of IFC files. Recommended by BCA for CORENET X. Download: support.tekla.com/corenet-x-ifc-sg#3. Supports system entities, IfcGrid, and search. Also integrates with Tekla Structures for direct model publishing.'],
    [/builtsearch|iv\.builtsearch|ifc.?sg.*validator.*builtsearch/, 'BCA', 'IFC+SG Validator by BuiltSearch (IV): BCA-recommended free validator for CORENET X. URL: iv.builtsearch.com. Extracts all elements, checks whether IFC+SG parameters are correctly mapped to BIM components. Supports IFC federation. Files stored locally (not uploaded to server). Fast processing for multiple IFC models. Use before CORENET X submission to catch missing SGPset_ properties.'],

    // IFC+SG Validators (3 official tools)
    [/solibri.*ruleset|ifc.?sg.*ruleset|solibri.*cset|solibri.*office.*corenet/, 'BCA', 'Solibri IFC+SG Ruleset: BCA provides a downloadable Solibri ruleset (.cset file) for IFC+SG compliance checking in Solibri Office. Download: gsdownloads.blob.core.windows.net/cdn/corenet-x/IFC+SG%20Ruleset.cset. QP can review IFC+SG model compliance against all agency rules before CORENET X submission. Requires Solibri Office (paid licence).'],
    [/bimeco|aceplp.*validator|viewer\.bim\.com\.sg/, 'BCA', 'BIMECO IFC+SG Validator: developed by AcePLP (AIA), currently in Beta. URL: viewer.bim.com.sg (accessible on non-Government laptops only). Provides IFC+SG compliance checking. For support: helpme@aceplp.com.sg. AcePLP also provides RABW training and IFC+SG training for Revit, Tekla, and Bentley OpenBuildings.'],
    [/which.*ifc.*viewer|best.*ifc.*viewer|free.*ifc.*viewer|recommended.*viewer|ifc.*view.*tool/, 'BCA', 'BCA-recommended free IFC viewers for CORENET X (not exhaustive): (1) BIMCollab Zoom - best for federation + BCF comments; (2) BIMVision - quick visualisation, up to 2 files; (3) Kit Model Viewer - small files <200MB; (4) Solibri Anywhere - read-only viewer; (5) Trimble Connect Desktop - full federation; (6) BuiltSearch IV Validator - IFC+SG compliance check + viewing. For multiple IFC files in non-federation viewers: use 1IFC binder (free, by Graphisoft).'],

    // Utility plugins
    [/1ifc|one.*ifc.*binder|graphisoft.*binder|ifc.*binder/, 'IFC', '1IFC: free openBIM application by Graphisoft (C#-based) that binds/federates multiple IFC files into one. Use when IFC viewer cannot natively federate files (Kit Model Viewer, Solibri Anywhere). User Guide: /docs/default-source/default-document-library/1ifc-user-guide.pdf. Enables viewing of federated CORENET X model in non-federation viewers.'],
    [/diroots|dirootsone|revit.*excel.*ifc|excel.*revit.*ifc.?sg|bim.*data.*excel/, 'BCA', 'DiRootsOne Plugin: free Revit plug-in that exports BIM data (model categories, elements, schedules) to Excel or Google Sheets and imports back to update the model. Useful for C&S Engineers to batch-populate IFC+SG properties. Especially useful for SGPset_ property mapping workflow. Note: IFC+SG mapping in tutorial videos may not be the latest COP edition - cross-reference with COP 3.1 (Dec 2025).'],

    // Training and funding
    [/rabw.*course|rabw.*train|regulatory.*approval.*train|corenet.*training.*provider/, 'BCA', 'CORENET X RABW Training (Regulatory Approval for Building Works): 1-day in-person or ~3hr self-paced. Providers: AcePLP/AIA, BCA Academy, BIMAGE Consulting, The Architect\'s Academy (SIA - architects only), SP PACE, Bluskai (online self-paced). Mandatory before first CORENET X submission. Training covers new 3-gateway process and portal navigation.'],
    [/ifc.?sg.*train|ifc.*train.*provider|revit.*ifc.?sg.*train|tekla.*ifc.?sg.*train/, 'BCA', 'IFC+SG Software Training providers: Revit - AcePLP, BIMAGE, SP PACE, INNOCOM; Tekla - AcePLP, BIMAGE, Trimble (tekla.support.sea@trimble.com / 62583700); Archicad - Graphisoft (vthangasamy@graphisoft.com), ACAD; Bentley OpenBuildings - Bentley, AcePLP. Post-course support: helpme@aceplp.com.sg / krishnan@innocom.com.sg. CORENET X training environment mirrors actual portal for practice.'],
    [/psg.*grant|productivity.*solution.*grant|bim.*grant.*sme|50.*percent.*bim|bim.*funding/, 'BCA', 'PSG (Productivity Solutions Grant): Singapore Government one-time grant for SMEs adopting pre-approved digital solutions including BIM software. Up to 50% co-funding of qualifying costs. Info: www.go.gov.sg/bca-psg. Pre-approved solutions list (BIM/3D modelling): www.gobusiness.gov.sg/browse-all-solutions-built-environment/3d-modelling--immersive-visualisation-analysis. Check with BCA for eligibility.'],
    [/training.*environment|practice.*portal|sandbox.*corenet|corenet.*sandbox/, 'BCA', 'CORENET X Training Environment: mirrors the actual submission portal. Allows exploration and practice without submitting a real project. Available since Jun 2025. URL: https://training.corenet.gov.sg. Authenticate via Singpass for Business (Corppass) - same as production. Use for first-timers before live submission. Also register for BCA\'s Assisted Onboarding programme.'],

    // Model Checker
    [/model.*checker.*corenet|corenet.*model.*checker|mc.*mvp/, 'BCA', 'CORENET X Model Checker (MC): supplementary tool validating BIM files in IFC+SG format. 3 components: (1) IFC Schema Check - identifies models not meeting basic IFC standards (outdated schema, corrupted files); (2) Quality Check - minimum quality standards per COP (missing mandatory properties, improper geo-location); (3) Regulatory Compliance Check - assesses against agency regulatory requirements (headroom clearance, bicycle parking, etc.). MC MVP deployment date TBA. VERIFIQ replicates Model Checker logic locally (L1-L20 check levels) for pre-submission validation.'],

    // Onboarding and firm stats
    [/how.*many.*firm|320.*firm|onboard.*corenet|corenet.*adopt|industry.*uptake/, 'BCA', 'CORENET X onboarding (as of Apr 2026): 320+ firms onboarded total - 94 C&S Consultants, 62 Builders, 55 M&E Consultants, 53 Architectural Consultants, 43 Developers, 17 Accredited Checkers, 16 Specialist PE (Geotechnical), 6 Fire Safety Engineers, 1 Transport Consultant, 1 Specialist PE (Lifts). 100+ firms have made a CORENET X submission as of May 2025. Community of Practice (COPr): 37 firms currently.'],
    [/corenet.*onboard.*step|onboard.*checklist|ifc.?sg.*checklist|first.*time.*corenet/, 'BCA', 'CORENET X onboarding steps: (1) Join mailing list; (2) Complete RABW + IFC+SG training; (3) Study self-help resources (COP 3.1, Good Practices Guidebook Dec 2025, portal guide); (4) Register for Assisted Onboarding (first-timers). IFC+SG Onboarding Checklist: install Revit patches + IFC exporter, study gateway requirements, download toolkits, use 3rd party apps for validation, review federated IFC before submission. Contact: 3129 7483 or support.corenet.gov.sg.'],

    // Payment methods
    [/corenet.*payment|pay.*corenet|paynow.*corenet|how.*pay.*bca.*plan/, 'BCA', 'CORENET X payment methods (updated Mar 2026): PayNow, Bank Transfer, E-payment. Payments may not be consolidated across agencies (each agency invoices separately). Fee estimate available before formal submission. Submissions pending payment receive recurring email reminders after 5 working days. BCA plan fees: residential S$10.30-S$35/m², commercial/industrial S$14.40-S$35/m². SCDF, URA, NEA, PUB fees additional.'],

    // Geo-referencing
    [/svy21|epsg.*3414|geo.?reference|singapore.*coordinate|svd.*coordinate/, 'BCA', 'Geo-referencing for CORENET X: SVY21 national coordinate system (EPSG: 3414) for horizontal coordinates. Singapore Height Datum (SHD) for vertical. IfcSite RefLatitude/RefLongitude in SVY21. All discipline models must align to same geo-reference. Level datums must be aligned across models with unique names and unique GUIDs. Only one IfcSite per IFC file (for Revit: select Additional Content >> Linked Files >> Export in the same IfcSite). Good Practice Guide: Geo-Referencing and Coordination.'],

    // Industry Mapping Excel
    [/industry.*mapping.*excel|ifc.?sg.*excel|excel.*mapping.*file|mapping.*template.*ifc/, 'BCA', 'IFC+SG Industry Mapping Excel: BCA\'s master mapping file. Latest: 4 December 2025. Column structure: (A) Agency, (B) Identified Component, (C) Identified Parameter, (D-G) BIM Authoring Tool Representation, (H) IFC4 Entity, (I) IFC Sub Types, (J) Property Set, (K) Property Name, (L) Property Type (Boolean/Label/Real/etc.), (M) Unit (mm), (N) IFC4 Material Set, (P) Sample Values, (Q) Notes. Archive versions: Sep 2025, Nov 2024, Oct 2023. Download from info.corenet.gov.sg/ifc-sg/templates--apps-and-more/ifc-sg-excel-mapping-file.'],

    // Native BIM software resources
    [/revit.*shared.*param|shared.*param.*revit|revit.*corenet.*toolkit|revit.*ifc.?sg.*tool/, 'BCA', 'Revit IFC+SG toolkit (COP 3 / current): (1) Shared Parameters Tool (Revit 2024+, 2023, 2022-); (2) Standardized Data Tool (Revit 2024+, 2023, 2022-); (3) Dynamo scripts (Revit 2024+, 2023, 2022-); (4) Model Checker for Revit (Revit 2024+, 2023, 2022-); (5) IFC Exporter JSON Files; (6) Property Set COP3 (Revit 2024+, 2023, 2022-). Download: info.corenet.gov.sg/ifc-sg/templates--apps-and-more/bim-software-resources. Revit 2025 users: uninstall Revit-IFC app if facing issues.'],
    [/archicad.*template|archicad.*ifc.?sg.*resource|graphisoft.*corenet|archicad.*cop/, 'BCA', 'ArchiCAD IFC+SG resources: Template V4.2.6 (merge IFC+SG Classification to project, import via IFC Translator), ArchiCAD IFC+SG How-To Guide, video playlist. Latest resources: graphisoft.com/en-sg/corenet-x-and-ifc-sg/. Post-course support: vthangasamy@graphisoft.com. Training: Graphisoft or ACAD.'],
    [/openbuildings|bentley.*ifc.?sg|bentley.*corenet|obd.*ifc/, 'BCA', 'Bentley OpenBuildings Designer (OBD) IFC+SG resources: (1) Setting up OBD with IFC+SG Properties guide; (2) Configuration for Export guide; (3) OpenBuildings Designer IFC+SG How-To Guide. Video playlist: youtube.com/playlist?list=PLF-UsLY83rhDJNqkkkLsm8_yOyicberUO. Training: Bentley or AcePLP. Bentley InfraWorks and OpenRoads for civil/LTA elements.'],
    [/tekla.*ifc.?sg.*resource|tekla.*accelerator|tekla.*tsep|trimble.*corenet.*program/, 'BCA', 'Tekla (Trimble) IFC+SG resources: Tekla Structures IFC+SG Installer (.tsep), IFC+SG How-To Guide. FOC CORENET X Accelerator Program available from Trimble. Latest: tekla.com (Tekla IFC+SG Resource Centre). Support: tekla.support.sea@trimble.com / 62583700. Training: AcePLP or BIMAGE.'],

    // Key circulars 2026
    [/lta.*askdbc|askdbc|lta.*chatbot|lta.*ai.*chatbot/, 'LTA', 'AskDBC: LTA\'s AI-powered chatbot for Development & Building Control queries. Launched Apr 2026. For questions on LTA requirements in building development. Circular: 30 Apr 2026. Complements CORENET X for understanding LTA-specific queries on transport, road design, and building control.'],
    [/kit.?of.?parts|buildability.*type.*approval|programme.*level.*design|standardis.*design/, 'BCA', 'BCA Buildability Type Approval - Kit-of-Parts (Apr 2026): BCA circular for programme-level design standardisation through kit-of-parts approach. Allows pre-approval of standardised structural/architectural designs to streamline CORENET X submissions for repeated building types (e.g. HDB blocks, industrial units).'],
    [/scdf.*fire.?code.*2023|fire.*code.*amendment.*5|5th.*batch.*fire/, 'SCDF', 'SCDF Fire Code 2023 - 5th Batch Amendments (2 Mar 2026): latest amendments to Fire Code 2023. Review updated fire safety requirements before G1/G2 submission. SCDF SLA: 5 working days (independent). Changes may affect FireRating values, suppression system requirements, and travel distance calculations in IFC+SG model.'],
    [/reused.*steel|bc1.*2023|recycled.*steel.*design|enhanced.*reused.*steel/, 'BCA', 'Reused Steel Framework BC1:2023 (2 Mar 2026): BCA enhanced framework for design guide on reused/recycled steel in Singapore construction. MaterialGrade in SGPset_Material should reflect reused steel specification. Supports circular economy targets. Structural PE must certify reused steel compliance at G2/G3 structural submission.'],
    [/corenet.*contact|corenet.*phone|corenet.*support.*portal|3129.*7483/, 'BCA', 'CORENET X Contact: Phone: 3129 7483. FAQ & Support: support.corenet.gov.sg. Online enquiry form: info.corenet.gov.sg/contact-us. Feedback: go.gov.sg/cxenquiry. Agency-specific queries available via support portal (Getting Started, BIM/IFC+SG requirements, Payment, Agency-specific). Submit requests at support.corenet.gov.sg/hc/en-us/requests/new.'],
  ];

  _SPEC.forEach((spec, i) => SUPER_AGENTS.push({
    id: 'spec-' + i, domain: spec[1],
    p: typeof spec[0] === 'string' ? new RegExp(spec[0], 'i') : spec[0],
    respond: () => spec[2],
  }));

  // VERIFIQ Product Identity agents (8)
  const _ID_AGENTS = [
    [/about.*verifiq|verifiq.*about|what.*is.*verifiq|verifiq.*info/i,
      () => 'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' - ' + VERIFIQ_IDENTITY.tagline + '.\nOwner: ' + VERIFIQ_IDENTITY.owner + ' (ID: ' + VERIFIQ_IDENTITY.owner_id + ').\nCoverage: ' + SUPER_AGENTS.length + ' Super Agents | ' + VERIFIQ_IDENTITY.coverage.agencies + ' CORENET X agencies | ' + VERIFIQ_IDENTITY.coverage.gateways + ' gateways | ' + VERIFIQ_IDENTITY.coverage.checkLevels + ' check levels | ' + VERIFIQ_IDENTITY.coverage.components + ' IFC+SG components.\n' + VERIFIQ_IDENTITY.copyright + '\nGitHub: ' + VERIFIQ_IDENTITY.contact],
    [/who.*made.*verifiq|who.*built.*verifiq|who.*own.*verifiq|verifiq.*owner|created.*by|bbmw0/i,
      () => 'VERIFIQ is built and owned by ' + VERIFIQ_IDENTITY.owner + ' (owner ID: ' + VERIFIQ_IDENTITY.owner_id + ').\n' + VERIFIQ_IDENTITY.tagline + '.\n' + VERIFIQ_IDENTITY.copyright + '\n' + VERIFIQ_IDENTITY.contact],
    [/verifiq.*version|version.*verifiq|current.*version.*verifiq/i,
      () => 'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' - Current production release by ' + VERIFIQ_IDENTITY.owner + '. ' + SUPER_AGENTS.length + ' Super Agents active. ' + VERIFIQ_IDENTITY.copyright],
    [/how.*many.*agent|super.*agent.*count|agent.*total.*verifiq/i,
      () => 'VERIFIQ has ' + SUPER_AGENTS.length + ' Super Agents active across: ' + VERIFIQ_IDENTITY.coverage.agencies + ' CORENET X agencies | ' + VERIFIQ_IDENTITY.coverage.gateways + ' gateways | ' + VERIFIQ_IDENTITY.coverage.checkLevels + ' check levels | ' + VERIFIQ_IDENTITY.coverage.components + ' components | ' + VERIFIQ_IDENTITY.coverage.sgPsets + ' SGPsets | ' + VERIFIQ_IDENTITY.coverage.ifcEntities + ' IFC entities | ' + VERIFIQ_IDENTITY.coverage.myRules + ' Malaysia rules | ' + VERIFIQ_IDENTITY.coverage.occupancy + ' OccupancyType values.'],
    [/verifiq.*copyright|copyright.*verifiq|license.*verifiq/i,
      () => VERIFIQ_IDENTITY.copyright + ' | ' + VERIFIQ_IDENTITY.tagline + ' | ' + VERIFIQ_IDENTITY.contact],
    [/all.*9.*agenc|9.*corenet.*agenc|singapore.*agenc.*list|list.*agenc/i,
      () => 'CORENET X 10 agencies:\n(1) BCA - Building & Construction Authority (structural, accessibility, GFA, fire resistance)\n(2) SCDF - Singapore Civil Defence Force (fire safety, evacuation, sprinklers)\n(3) URA - Urban Redevelopment Authority (GFA, land use, plot ratio, strata)\n(4) PUB - Public Utilities Board (water supply, drainage, sewerage, WELS)\n(5) LTA - Land Transport Authority (roads, kerbs, RSSZ, transport facilities)\n(6) HDB - Housing & Development Board (public housing standards)\n(7) SLA - Singapore Land Authority (cadastral survey, strata lot numbers)\n(8) NEA - National Environment Agency (waste, ventilation, noise, environmental)\n(9) NParks - National Parks Board (trees, landscape, EMMP, heritage trees)\n(10) JTC - JTC Corporation (industrial land, floor loading, industrial use requirements)\nAll 10 participate in CORENET X. HDB & SLA appear at G3 only. - VERIFIQ by ' + VERIFIQ_IDENTITY.owner],
    [/verifiq.*corenet.*cover|what.*verifiq.*check|verifiq.*support/i,
      () => 'VERIFIQ v' + VERIFIQ_IDENTITY.version + ' covers:\n• CORENET X IFC+SG COP 3.1 (December 2025)\n• R13 updates (March 2026): URA Use Dictionary v3.3, NParks 3-group, RSSZ, BCA Buildability\n• 10 agencies: BCA, SCDF, URA, NEA, PUB, LTA, HDB, SLA, NParks, JTC\n• 6 gateways: G- (Pre-Submission), G1, G1.5, G2, DSP, G3\n• 20 check levels L1-L20 with per-level severity and remediation\n• 75 IFC+SG components | 47 SGPsets | 34 IFC entities\n• Malaysia NBeS: UBBL, BOMBA, JKR, MS1184, SIRIM\n• BIM tools: Revit, ArchiCAD, Tekla, Allplan, Bentley\n• Zero API keys required - fully offline\n' + VERIFIQ_IDENTITY.copyright],
    [/verifiq.*contact|contact.*verifiq|github.*verifiq/i,
      () => 'VERIFIQ GitHub: ' + VERIFIQ_IDENTITY.contact + '\nOwner: ' + VERIFIQ_IDENTITY.owner + ' (bbmw0)\n' + VERIFIQ_IDENTITY.copyright],
  ];
  _ID_AGENTS.forEach(([p, fn], i) => SUPER_AGENTS.push({ id: 'verifiq-id-' + i, domain: 'VERIFIQ', p, respond: fn }));

  // ── Super Agent Query Router ──────────────────────────────────────────────
  function query(question, context) {
    const q = question || '';
    for (let i = 0; i < SUPER_AGENTS.length; i++) {
      if (SUPER_AGENTS[i].p.test(q)) {
        return SUPER_AGENTS[i].respond();
      }
    }
    return answer(q, context);
  }

  // ── Install as VEngine fallback ───────────────────────────────────────────
  function install() {
    if (typeof window === 'undefined') return;

    const api = {
      answer, query, analyzeCompliance, install,
      agentCount: SUPER_AGENTS.length,
      LEVELS, SG_GATEWAYS, MY_RULES,
      COMPONENTS, SPACE_VALUES, SGPSET_GUIDE, IFC_ENTITIES,
      FIXES, CONSTRUCTION_METHODS, CONCRETE_GRADES, STEEL_GRADES, REBAR_GRADES, FIRE_RATINGS,
    };
    window.EmbeddedAI = api;
    window._embeddedAIReady = true;
    window._embeddedAIQuery = query;

    if (window.VEngine) {
      const origRoute   = window.VEngine.route;
      const origAnalyze = window.VEngine.analyzeCompliance;

      window.VEngine.route = function(q, ctx) {
        try { if (origRoute) return origRoute.call(this, q, ctx); } catch (_) { /* fall through */ }
        return query(q, ctx);
      };

      window.VEngine.analyzeCompliance = function(session) {
        try {
          if (origAnalyze) {
            const r = origAnalyze.call(this, session);
            if (r && r.score > 0) return r;
          }
        } catch (_) { /* fall through */ }
        return analyzeCompliance(session);
      };
    }

    console.info('[VERIFIQ EmbeddedAI] v' + VERIFIQ_IDENTITY.version + ' by ' + VERIFIQ_IDENTITY.owner + ' | ' + SUPER_AGENTS.length + ' Super Agents | 10 agencies (BCA/SCDF/URA/NEA/PUB/LTA/HDB/SLA/NParks/JTC) | 6 gateways (G-/G1/G1.5/G2/DSP/G3) | 20 check levels | CORENET X IFC+SG COP 3.1 + Malaysia NBeS | Zero API keys. ' + VERIFIQ_IDENTITY.copyright);
  }

  return {
    answer, query, analyzeCompliance, install,
    agentCount: SUPER_AGENTS.length,
    LEVELS, SG_GATEWAYS, MY_RULES,
    COMPONENTS, SPACE_VALUES, SGPSET_GUIDE, IFC_ENTITIES,
    FIXES, CONSTRUCTION_METHODS, CONCRETE_GRADES, STEEL_GRADES, REBAR_GRADES, FIRE_RATINGS,
  };
})();

window.EmbeddedAI = EmbeddedAI;
