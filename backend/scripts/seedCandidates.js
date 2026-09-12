const mongoose = require('mongoose');
const connectToDatabase = require('../config/db');
const User = require('../models/User');
const { normalizeSkills } = require('../config/taxonomies');

const DEMO_PREFIX = 'demo-cand-';

const colleges = {
  iitb: { name: 'IIT Bombay', collegeId: 'iit-bombay' },
  vit: { name: 'VIT Vellore', collegeId: 'vit-vellore' },
  manipal: { name: 'Manipal Institute of Technology', collegeId: 'mit-manipal' },
  coep: { name: 'COEP Technological University', collegeId: 'coep-tech' },
  bits: { name: 'BITS Pilani', collegeId: 'bits-pilani' },
  srcc: { name: 'Shri Ram College of Commerce', collegeId: 'srcc' },
};

const locations = {
  mumbai: { city: 'Mumbai', state: 'Maharashtra', region: 'West India' },
  pune: { city: 'Pune', state: 'Maharashtra', region: 'West India' },
  bengaluru: { city: 'Bengaluru', state: 'Karnataka', region: 'South India' },
  delhi: { city: 'New Delhi', state: 'Delhi', region: 'North India' },
  chennai: { city: 'Chennai', state: 'Tamil Nadu', region: 'South India' },
  jaipur: { city: 'Jaipur', state: 'Rajasthan', region: 'North India' },
};

const skill = (name, level) => ({ name, level });

const demoCandidates = [
  {
    id: '01', name: 'Aarav Mehta', college: colleges.iitb, location: locations.mumbai,
    department: 'Computer Science', year: '4th Year', roles: ['Full Stack Developer', 'Backend Developer'],
    skills: [skill('ReactJS', 'Advanced'), skill('NodeJS', 'Advanced'), skill('MongoDB', 'Advanced'), skill('Express.js', 'Advanced'), skill('TypeScript', 'Intermediate')],
    domainInterests: ['SaaS', 'Marketplace', 'EdTech'], availability: 'part-time', hoursPerWeek: 22, workPreference: 'hybrid', experience: 2,
    bio: 'Full stack builder focused on marketplace and SaaS MVPs.', interests: ['hackathons', 'developer tools', 'campus products'], qualifications: ['Built two MERN MVPs', 'Finalist at campus startup challenge'],
  },
  {
    id: '02', name: 'Nisha Rao', college: colleges.vit, location: locations.bengaluru,
    department: 'Information Technology', year: '3rd Year', roles: ['Full Stack Developer', 'Frontend Developer'],
    skills: [skill('React.js', 'Advanced'), skill('Node.js', 'Intermediate'), skill('MongoDB', 'Intermediate'), skill('Firebase', 'Intermediate'), skill('Tailwind CSS', 'Advanced')],
    domainInterests: ['EdTech', 'Social', 'E-commerce'], availability: 'part-time', hoursPerWeek: 18, workPreference: 'remote', experience: 1.5,
    bio: 'Frontend-heavy full stack candidate with strong product instincts.', interests: ['community apps', 'student productivity'], qualifications: ['React project lead', 'Open-source contributor'],
  },
  {
    id: '03', name: 'Kabir Sethi', college: colleges.bits, location: locations.delhi,
    department: 'Computer Science', year: '4th Year', roles: ['Full Stack Developer', 'Backend Developer'],
    skills: [skill('React JS', 'Intermediate'), skill('Node.js', 'Advanced'), skill('PostgreSQL', 'Advanced'), skill('Docker', 'Intermediate'), skill('REST API', 'Advanced')],
    domainInterests: ['FinTech', 'SaaS'], availability: 'full-time', hoursPerWeek: 35, workPreference: 'in-person', experience: 2,
    bio: 'Backend-oriented full stack developer interested in transactional systems.', interests: ['fintech APIs', 'distributed systems'], qualifications: ['Interned at fintech startup', 'Database systems TA'],
  },
  {
    id: '04', name: 'Saanvi Kulkarni', college: colleges.coep, location: locations.pune,
    department: 'Computer Engineering', year: '3rd Year', roles: ['Backend Developer'],
    skills: [skill('Node.js', 'Advanced'), skill('Express', 'Advanced'), skill('MongoDB', 'Intermediate'), skill('REST API', 'Advanced'), skill('Docker', 'Beginner')],
    domainInterests: ['Marketplace', 'SaaS'], availability: 'part-time', hoursPerWeek: 16, workPreference: 'hybrid', experience: 1,
    bio: 'API-focused backend developer comfortable with Node and MongoDB.', interests: ['API design', 'backend reliability'], qualifications: ['Backend lead for college marketplace project'],
  },
  {
    id: '05', name: 'Rohan Iyer', college: colleges.manipal, location: locations.chennai,
    department: 'Data Science', year: '2nd Year', roles: ['Backend Developer', 'Data Scientist'],
    skills: [skill('Python', 'Advanced'), skill('FastAPI', 'Intermediate'), skill('PostgreSQL', 'Intermediate'), skill('Data Science', 'Intermediate')],
    domainInterests: ['HealthTech', 'AI'], availability: 'part-time', hoursPerWeek: 12, workPreference: 'remote', experience: 1,
    bio: 'Python backend candidate who prefers analytics-heavy products.', interests: ['clinical data', 'analytics APIs'], qualifications: ['FastAPI analytics dashboard'],
  },
  {
    id: '06', name: 'Meera Thomas', college: colleges.vit, location: locations.bengaluru,
    department: 'Electronics and Communication', year: '4th Year', roles: ['Backend Developer', 'DevOps Engineer'],
    skills: [skill('NodeJS', 'Intermediate'), skill('PostgreSQL', 'Advanced'), skill('Docker', 'Advanced'), skill('AWS', 'Intermediate')],
    domainInterests: ['Climate', 'SaaS'], availability: 'full-time', hoursPerWeek: 30, workPreference: 'remote', experience: 2,
    bio: 'Infrastructure-minded backend developer with deployment experience.', interests: ['cloud infrastructure', 'climate software'], qualifications: ['AWS cloud club core team'],
  },
  {
    id: '07', name: 'Devansh Shah', college: colleges.iitb, location: locations.mumbai,
    department: 'Computer Science', year: '2nd Year', roles: ['Frontend Developer'],
    skills: [skill('React', 'Intermediate'), skill('JavaScript', 'Intermediate'), skill('TailwindCSS', 'Intermediate')],
    domainInterests: ['Marketplace', 'Social'], availability: 'part-time', hoursPerWeek: 10, workPreference: 'hybrid', experience: 0.5,
    bio: 'Partial-match frontend candidate, strongest in React UI implementation.', interests: ['student communities', 'frontend patterns'], qualifications: ['Built club portal frontend'],
  },
  {
    id: '08', name: 'Anika Bose', college: colleges.manipal, location: locations.bengaluru,
    department: 'Computer Science', year: '3rd Year', roles: ['Frontend Developer', 'UI/UX Designer'],
    skills: [skill('React.js', 'Advanced'), skill('TypeScript', 'Intermediate'), skill('Figma', 'Intermediate'), skill('Tailwind CSS', 'Advanced')],
    domainInterests: ['EdTech', 'HealthTech'], availability: 'part-time', hoursPerWeek: 20, workPreference: 'remote', experience: 1.5,
    bio: 'Design-aware frontend developer for polished user flows.', interests: ['learning platforms', 'accessible UI'], qualifications: ['Won college UI sprint'],
  },
  {
    id: '09', name: 'Pranav Menon', college: colleges.coep, location: locations.pune,
    department: 'Information Technology', year: '3rd Year', roles: ['Frontend Developer'],
    skills: [skill('JavaScript', 'Advanced'), skill('React', 'Beginner'), skill('Firebase', 'Intermediate')],
    domainInterests: ['FinTech', 'E-commerce'], availability: 'flexible', hoursPerWeek: 14, workPreference: 'in-person', experience: 1,
    bio: 'Frontend candidate with useful JS skills but limited React depth.', interests: ['payments UX', 'commerce'], qualifications: ['Built Firebase event app'],
  },
  {
    id: '10', name: 'Ira Nair', college: colleges.bits, location: locations.delhi,
    department: 'Design', year: '4th Year', roles: ['UI/UX Designer', 'Product Manager'],
    skills: [skill('Figma', 'Advanced'), skill('UI/UX Design', 'Advanced'), skill('Product Management', 'Intermediate')],
    domainInterests: ['SaaS', 'Marketplace', 'Social'], availability: 'part-time', hoursPerWeek: 18, workPreference: 'hybrid', experience: 2,
    bio: 'Senior student designer strong in research, wireframes, and product clarity.', interests: ['user research', 'design systems'], qualifications: ['Designed incubator demo day app'],
  },
  {
    id: '11', name: 'Zoya Khan', college: colleges.srcc, location: locations.delhi,
    department: 'Human-Computer Interaction', year: '3rd Year', roles: ['UI/UX Designer'],
    skills: [skill('Figma', 'Intermediate'), skill('UI/UX Design', 'Intermediate'), skill('Marketing', 'Beginner')],
    domainInterests: ['E-commerce', 'Social'], availability: 'part-time', hoursPerWeek: 12, workPreference: 'remote', experience: 1,
    bio: 'UX candidate focused on research and consumer app flows.', interests: ['consumer psychology', 'creator tools'], qualifications: ['User research internship'],
  },
  {
    id: '12', name: 'Harsh Vardhan', college: colleges.vit, location: locations.jaipur,
    department: 'Design', year: '2nd Year', roles: ['UI/UX Designer'],
    skills: [skill('Figma', 'Beginner'), skill('UI/UX Design', 'Intermediate')],
    domainInterests: ['Climate', 'HealthTech'], availability: 'flexible', hoursPerWeek: 8, workPreference: 'remote', experience: 0.5,
    bio: 'Early UI/UX candidate, good for partial design support.', interests: ['visual design', 'impact products'], qualifications: ['Campus design club member'],
  },
  {
    id: '13', name: 'Tara Bhatia', college: colleges.iitb, location: locations.mumbai,
    department: 'Artificial Intelligence', year: '4th Year', roles: ['ML Engineer', 'Data Scientist'],
    skills: [skill('Python', 'Advanced'), skill('Machine Learning', 'Advanced'), skill('Data Science', 'Advanced'), skill('NLP', 'Intermediate')],
    domainInterests: ['AI', 'HealthTech', 'EdTech'], availability: 'part-time', hoursPerWeek: 20, workPreference: 'hybrid', experience: 2,
    bio: 'ML engineer candidate strong in model prototyping and NLP.', interests: ['LLM applications', 'medical AI'], qualifications: ['Published student ML paper'],
  },
  {
    id: '14', name: 'Omkar Patil', college: colleges.coep, location: locations.pune,
    department: 'Data Science', year: '3rd Year', roles: ['Data Scientist', 'Backend Developer'],
    skills: [skill('Python', 'Advanced'), skill('Data Science', 'Intermediate'), skill('PostgreSQL', 'Intermediate'), skill('FastAPI', 'Beginner')],
    domainInterests: ['FinTech', 'AI'], availability: 'full-time', hoursPerWeek: 32, workPreference: 'hybrid', experience: 1.5,
    bio: 'Data scientist with backend API exposure, strongest for analytics ideas.', interests: ['credit risk', 'dashboards'], qualifications: ['Kaggle campus winner'],
  },
  {
    id: '15', name: 'Leena Mathew', college: colleges.manipal, location: locations.chennai,
    department: 'AI and ML', year: '2nd Year', roles: ['ML Engineer'],
    skills: [skill('Python', 'Intermediate'), skill('Machine Learning', 'Intermediate'), skill('NLP', 'Beginner')],
    domainInterests: ['AI', 'Social'], availability: 'part-time', hoursPerWeek: 10, workPreference: 'remote', experience: 0.5,
    bio: 'Junior ML candidate suitable for experimentation support.', interests: ['NLP experiments', 'social listening'], qualifications: ['Built sentiment analysis prototype'],
  },
  {
    id: '16', name: 'Aditya Verma', college: colleges.srcc, location: locations.delhi,
    department: 'Commerce', year: '4th Year', roles: ['Marketing Lead', 'Business Development'],
    skills: [skill('Marketing', 'Advanced'), skill('Business Development', 'Advanced'), skill('Product Management', 'Intermediate')],
    domainInterests: ['Marketplace', 'E-commerce', 'SaaS'], availability: 'part-time', hoursPerWeek: 20, workPreference: 'in-person', experience: 2,
    bio: 'Growth candidate with strong campus acquisition and partnerships experience.', interests: ['go-to-market', 'campus ambassadors'], qualifications: ['Led 5k-user college fest campaign'],
  },
  {
    id: '17', name: 'Mitali Deshpande', college: colleges.coep, location: locations.pune,
    department: 'Business Administration', year: '3rd Year', roles: ['Marketing Lead'],
    skills: [skill('Marketing', 'Intermediate'), skill('Business Development', 'Intermediate')],
    domainInterests: ['EdTech', 'Climate'], availability: 'part-time', hoursPerWeek: 15, workPreference: 'hybrid', experience: 1,
    bio: 'Marketing candidate who prefers mission-driven startups.', interests: ['content marketing', 'community building'], qualifications: ['Managed social media for NGO campaign'],
  },
  {
    id: '18', name: 'Sameer Ansari', college: colleges.vit, location: locations.bengaluru,
    department: 'MBA Tech', year: '2nd Year', roles: ['Business Development', 'Product Manager'],
    skills: [skill('Business Development', 'Advanced'), skill('Product Management', 'Intermediate'), skill('Marketing', 'Intermediate')],
    domainInterests: ['FinTech', 'SaaS'], availability: 'full-time', hoursPerWeek: 28, workPreference: 'remote', experience: 1.5,
    bio: 'BD candidate with B2B SaaS outreach interest.', interests: ['sales funnels', 'partnerships'], qualifications: ['B2B outreach internship'],
  },
  {
    id: '19', name: 'Pooja Krishnan', college: colleges.bits, location: locations.chennai,
    department: 'Economics', year: '3rd Year', roles: ['Marketing Lead', 'UI/UX Designer'],
    skills: [skill('Marketing', 'Intermediate'), skill('Figma', 'Beginner'), skill('Product Management', 'Beginner')],
    domainInterests: ['Social', 'E-commerce'], availability: 'flexible', hoursPerWeek: 12, workPreference: 'remote', experience: 1,
    bio: 'Hybrid growth and light-design candidate for consumer startups.', interests: ['creator economy', 'brand positioning'], qualifications: ['Ran creator newsletter'],
  },
  {
    id: '20', name: 'Yash Gupta', college: colleges.iitb, location: locations.mumbai,
    department: 'Mechanical Engineering', year: '1st Year', roles: ['Backend Developer'],
    skills: [skill('React', 'Intermediate'), skill('MongoDB', 'Beginner'), skill('Python', 'Beginner')],
    domainInterests: ['Climate', 'Hardware'], availability: 'full-time', hoursPerWeek: 8, workPreference: 'in-person', experience: 0,
    bio: 'Intentional role/domain/work-mode mismatch candidate for ranking tests.', interests: ['hardware clubs', 'climate tech'], qualifications: ['Learning web development'],
  },
];

const toUserDocument = (candidate) => {
  const firebaseUid = `${DEMO_PREFIX}${candidate.id}`;
  const normalizedSkills = normalizeSkills(candidate.skills);

  return {
    firebaseUid,
    email: `${firebaseUid}@startuplink.demo`,
    name: candidate.name,
    profileImage: '',
    profileType: 'candidate',
    college: candidate.college,
    location: candidate.location,
    skills: normalizedSkills,
    interests: [
      ...candidate.interests,
      `Department: ${candidate.department}`,
      `Year: ${candidate.year}`,
    ],
    bio: candidate.bio,
    targetRoles: candidate.roles,
    experience: candidate.experience,
    qualifications: candidate.qualifications,
    domainInterests: candidate.domainInterests,
    availability: candidate.availability,
    hoursPerWeek: candidate.hoursPerWeek,
    workPreference: candidate.workPreference,
    profileCompleted: true,
  };
};

const countByValue = (records, getter) => {
  const counts = {};
  for (const record of records) {
    for (const value of getter(record)) {
      counts[value] = (counts[value] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};

const printCounts = (title, counts) => {
  console.log(`\n${title}:`);
  for (const [key, value] of Object.entries(counts)) {
    console.log(`${key}: ${value}`);
  }
};

async function seedCandidates() {
  await connectToDatabase();

  try {
    const operations = demoCandidates.map((candidate) => {
      const userDocument = toUserDocument(candidate);
      return User.findOneAndUpdate(
        { firebaseUid: userDocument.firebaseUid },
        { $set: userDocument },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      ).lean();
    });

    await Promise.all(operations);

    const seededCandidates = await User.find({
      firebaseUid: { $regex: `^${DEMO_PREFIX}` },
      profileType: 'candidate',
    })
      .select('firebaseUid name college skills interests targetRoles domainInterests availability workPreference hoursPerWeek profileCompleted')
      .sort({ firebaseUid: 1 })
      .lean();

    const duplicateGroups = await User.aggregate([
      { $match: { firebaseUid: { $regex: `^${DEMO_PREFIX}` } } },
      { $group: { _id: '$firebaseUid', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    const eligibleCount = await User.countDocuments({
      firebaseUid: { $regex: `^${DEMO_PREFIX}` },
      profileType: 'candidate',
      profileCompleted: true,
    });

    const roleDistribution = countByValue(seededCandidates, (candidate) => candidate.targetRoles || []);
    const skillDistribution = countByValue(seededCandidates, (candidate) => (candidate.skills || []).map((item) => item.name));

    console.log('\nSeed completed successfully.');
    console.log(`\nCandidates:\n${seededCandidates.length}`);
    console.log(`Matching eligible candidates:\n${eligibleCount}`);
    console.log(`Duplicate demo Firebase UIDs:\n${duplicateGroups.length}`);
    printCounts('Role distribution', roleDistribution);
    printCounts('Skill distribution', skillDistribution);

    console.log('\nSample records:');
    seededCandidates.slice(0, 5).forEach((candidate) => {
      console.log({
        firebaseUid: candidate.firebaseUid,
        name: candidate.name,
        college: candidate.college?.name,
        profileCompleted: candidate.profileCompleted,
        targetRoles: candidate.targetRoles,
        skills: (candidate.skills || []).map((item) => `${item.name}:${item.level}`),
        domainInterests: candidate.domainInterests,
        availability: candidate.availability,
        workPreference: candidate.workPreference,
        hoursPerWeek: candidate.hoursPerWeek,
      });
    });
  } finally {
    await mongoose.connection.close();
  }
}

seedCandidates().catch(async (error) => {
  console.error('Candidate seed failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore close errors during failure cleanup
  }
  process.exitCode = 1;
});
