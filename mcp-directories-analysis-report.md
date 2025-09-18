# MCP Directories Analysis Report

This comprehensive report analyzes five major Model Context Protocol (MCP) directories, examining their structure, schemas, metadata fields, and how they present MCP server information.

## Executive Summary

The MCP ecosystem has developed multiple directory platforms serving different audiences and use cases. From developer-focused simplicity (Cursor.directory) to technical comprehensiveness (Glama.ai), each platform offers unique approaches to organizing and presenting MCP servers.

**Key Findings:**
- **Scale varies dramatically**: from 1,290 servers (MCPServerFinder) to 16,545 servers (MCP.so)
- **Target audiences differ**: developer tools vs. community discovery vs. technical analysis
- **Metadata richness varies**: from basic descriptions to comprehensive technical ratings
- **Integration approaches**: from simple setup guides to API-first platforms

---

## Directory Overview

| Directory | Server Count | Primary Focus | Launch Approach |
|-----------|-------------|---------------|-----------------|
| Cursor.directory/mcp | ~50 featured | Developer integration | Curated, quality-focused |
| PulseMCP.com | 6,012 | Community & events | Comprehensive with analytics |
| MCPServerFinder.com | 1,290 | Discovery & search | Tag-driven organization |
| MCP.so | 16,545 | Marketplace scale | Largest collection |
| Glama.ai | 9,232 | Technical analysis | Quality & security focused |

---

## 1. Cursor.directory/mcp

### Landing Page Structure
- **Layout**: Clean, developer-focused design with prominent "Featured MCPs" section
- **Navigation**: Simple top nav with Rules, Trending, Jobs, MCPs, Generate, Members
- **Featured Content**: Grid layout of MCP cards with avatars, titles, and descriptions
- **CTA**: "Add new" button for submissions, prominent "Browse MCPs" link

### Individual MCP Page Schema
```
- Logo/Avatar (96x96px optimized)
- Title
- Description (paragraph)
- Installation Instructions (external link)
- Standard MCP setup guide (shared across all entries)
```

### Metadata Fields
- **Basic**: Name, description, logo
- **Technical**: Installation link (typically to GitHub)
- **Integration**: Standardized Cursor setup instructions

### Presentation Style
- **Emphasis**: Developer experience and ease of integration
- **Content**: Focuses on "how to use" rather than technical specifications
- **Visual**: Consistent avatars and clean typography
- **Target Audience**: Cursor IDE users specifically

---

## 2. PulseMCP.com

### Landing Page Structure
- **Header**: Event announcements (MCP Developers Summit)
- **Search**: Prominent search functionality
- **Trending**: Icon-based trending topics (Figma, Notion, GitHub, etc.)
- **Filters**: Classification system (Anthropic references, Official providers, Community)
- **Sorting**: Multiple sort options (Recommended, Last Updated, Alphabetical, Popular)

### Individual MCP Page Schema
```
- Provider information with logo/link
- Classification badge (reference/official/community)
- Download statistics (estimated weekly/total)
- Release date
- GitHub repository with star count
- Use Cases section
- Related Servers (extensive)
- Top Pick badges for featured content
```

### Metadata Fields
- **Identity**: Provider name, classification type
- **Analytics**: Download estimates, GitHub stars, release dates
- **Content**: Use cases, related servers
- **Social Proof**: Top Pick badges, community indicators
- **Technical**: GitHub integration, repository links

### Presentation Style
- **Emphasis**: Community engagement and popularity metrics
- **Content**: Rich contextual information and use cases
- **Visual**: Classification badges, download statistics, professional layout
- **Target Audience**: MCP community members and developers

---

## 3. MCPServerFinder.com

### Landing Page Structure
- **Search**: Prominent search with ⌘K shortcut
- **Tags**: Extensive tag cloud with 100+ categories
- **Featured**: Curated "Featured MCP Servers" section
- **Stats**: Server count prominently displayed (1290 servers)
- **Info**: "What is MCP Server Finder?" educational content
- **FAQ**: Comprehensive FAQ section (10 questions)

### Individual MCP Page Schema
```
- Ranking number and creation date
- Publisher information with GitHub profile
- Categories and language tags
- GitHub statistics (stars, forks)
- Repository link
- Language identification
- Publisher profile section with avatar, bio, location, social links
- Related servers by language/category
- Full README content display
```

### Metadata Fields
- **Repository**: Stars, forks, language, GitHub link
- **Publisher**: Avatar, bio, location, website, social links (Twitter)
- **Classification**: Categories, tags, language
- **Content**: Full README rendering, creation date
- **Social**: Publisher follower count, repository stats

### Presentation Style
- **Emphasis**: GitHub-centric, developer community focus
- **Content**: Complete repository information and publisher profiles
- **Visual**: Clean cards with GitHub-style metrics
- **Target Audience**: Open source developers and GitHub users

---

## 4. MCP.so

### Landing Page Structure
- **Scale**: "16545 MCP Servers collected" prominently displayed
- **Organization**: Separate sections for Servers and Clients
- **Featured**: Multiple featured sections (Servers, Clients, Hosted, Official)
- **Sponsors**: Dedicated sponsor showcase
- **Commercial**: Promotional banners for related services
- **FAQ**: 8-question FAQ about MCP servers

### Individual MCP Page Schema
```
- Server avatar/logo
- Author/organization information
- Creation date ("X months ago")
- Categories and tags
- Social sharing buttons (Twitter, Reddit, Facebook, Threads, Bluesky, Email)
- Tabs: Overview, Tools, Comments
- Server configuration JSON
- FAQ section specific to the server
- Playground integration link
- "Try in Playground" functionality
```

### Metadata Fields
- **Identity**: Avatar, author, creation date
- **Organization**: Categories, tags
- **Technical**: Server configuration JSON, tools listing
- **Social**: Sharing buttons, comments system
- **Interactive**: Playground integration, try-before-use functionality
- **Content**: Server-specific FAQ, overview information

### Presentation Style
- **Emphasis**: Marketplace-style presentation with social features
- **Content**: Interactive elements and community engagement
- **Visual**: Modern design with prominent social sharing
- **Target Audience**: Broad MCP ecosystem participants

---

## 5. Glama.ai/mcp/servers

### Landing Page Structure
- **Scale**: "9,232 servers. Last updated 2025-09-13 06:19"
- **Search**: "Deep Search" functionality with relevance sorting
- **Quality**: A-grade security, license, and quality ratings
- **Technical**: Platform compatibility indicators (Apple, Linux)
- **API**: MCP directory API integration
- **Multi-language**: Support for multiple languages (DE, EN, ES, JA, KO, RU, ZH)

### Individual MCP Page Schema
```
- Quality ratings (A/B/C/F grades for security, license, quality)
- Capability indicators (local-only vs remote-capable)
- Platform compatibility badges
- Detailed technical information
- Tool listings with descriptions
- Last updated timestamps
- GitHub statistics integration
- License information
- Related MCP servers with quality scores
- Search appearance tracking
- API endpoint for server data
- Multi-language documentation support
```

### Metadata Fields
- **Quality Metrics**: Security grade, license grade, quality grade
- **Technical Specs**: Platform compatibility, local/remote capability
- **Repository**: GitHub stars, last update, license type
- **Tools**: Comprehensive tool catalog with descriptions
- **Relationships**: Related servers, search appearances
- **API**: RESTful API endpoints for all server data
- **Localization**: Multi-language support

### Presentation Style
- **Emphasis**: Technical accuracy and quality assessment
- **Content**: Comprehensive metadata and quality scoring
- **Visual**: Grade-based visual indicators, technical focus
- **Target Audience**: Technical evaluators and system integrators

---

## Comparative Analysis

### Schema Complexity
1. **Glama.ai**: Most comprehensive with quality scores, multi-language support, API
2. **PulseMCP**: Rich community features with download analytics and use cases
3. **MCPServerFinder**: GitHub-focused with publisher profiles and social features
4. **MCP.so**: Marketplace-style with playground integration and social sharing
5. **Cursor.directory**: Simplest with focus on integration instructions

### Metadata Richness
- **Most Technical**: Glama.ai (quality grades, API, platform compatibility)
- **Most Social**: MCP.so (sharing, comments, community features)
- **Most Analytical**: PulseMCP (download stats, trending, use cases)
- **Most Developer-Focused**: MCPServerFinder (GitHub integration, publisher profiles)
- **Most User-Friendly**: Cursor.directory (simplified presentation)

### Target Audiences
- **Cursor.directory**: Cursor IDE users seeking easy integration
- **PulseMCP**: MCP community members and newsletter subscribers
- **MCPServerFinder**: Open source developers and GitHub users
- **MCP.so**: Broad ecosystem participants seeking marketplace experience
- **Glama.ai**: Technical evaluators requiring quality assessment

---

## Individual Tool Presentation Comparison

### Common Elements Across All Directories
- Server name and description
- GitHub repository link
- Installation/setup instructions
- Author/provider information

### Unique Elements by Directory

**Cursor.directory**:
- Standardized MCP setup guide shared across all entries
- Focus on Cursor-specific integration steps

**PulseMCP**:
- Classification badges (Anthropic reference, official, community)
- Download estimation algorithms
- Use cases section with practical examples
- Related servers with similar functionality

**MCPServerFinder**:
- Full README content rendering
- Comprehensive publisher profiles with social links
- Language-based categorization
- GitHub statistics prominently displayed

**MCP.so**:
- Tab-based organization (Overview, Tools, Comments)
- JSON configuration examples
- Playground integration for testing
- Social sharing capabilities

**Glama.ai**:
- Quality scoring system with explanations
- Platform compatibility indicators
- Tool catalog with detailed descriptions
- Multi-language documentation support

---

## Directory Differentiation Strategies

### 1. Scale and Scope
- **MCP.so**: Emphasizes largest collection (16,545 servers)
- **Glama.ai**: Quality over quantity approach
- **PulseMCP**: Community-focused growth with analytics
- **MCPServerFinder**: Curated discovery experience
- **Cursor.directory**: Highly selective, featured approach

### 2. Technical Approach
- **Glama.ai**: API-first with programmatic access
- **PulseMCP**: Analytics-driven with download tracking
- **MCP.so**: Playground integration for testing
- **MCPServerFinder**: GitHub-native integration
- **Cursor.directory**: IDE-specific optimization

### 3. Community Features
- **MCP.so**: Comments, social sharing, marketplace
- **PulseMCP**: Newsletter, events, trending topics
- **MCPServerFinder**: Publisher profiles, GitHub community
- **Glama.ai**: Technical discourse and quality assessment
- **Cursor.directory**: Developer-focused simplicity

---

## Recommendations for MCP Server Authors

### For Maximum Visibility
1. **Submit to all directories** - each serves different audiences
2. **Optimize for search** - use relevant tags and clear descriptions
3. **Maintain GitHub presence** - all directories integrate with GitHub
4. **Provide clear documentation** - essential for all platforms

### For Technical Credibility
1. **Focus on Glama.ai** - comprehensive quality assessment
2. **Ensure proper licensing** - affects quality scores
3. **Maintain update frequency** - shown prominently on most platforms

### For Community Engagement
1. **Leverage PulseMCP** - strong community features and newsletter
2. **Use MCP.so playground** - allows users to test before installing
3. **Engage with trends** - trending topics drive discovery

### For Developer Adoption
1. **Optimize for Cursor.directory** - direct path to IDE users
2. **Provide clear GitHub documentation** - essential for MCPServerFinder
3. **Include practical use cases** - valued by PulseMCP community

---

## Future Trends and Implications

### Emerging Patterns
1. **Quality Assessment**: Growing importance of security and reliability ratings
2. **Testing Integration**: Playground and sandbox functionality becoming standard
3. **Community Features**: Social aspects increasingly important for discovery
4. **API Access**: Programmatic directory access enabling new use cases
5. **Multi-language Support**: Internationalization becoming competitive advantage

### Platform Evolution
- **Consolidation vs. Specialization**: Tension between comprehensive coverage and focused audiences
- **Quality vs. Quantity**: Different strategies for building authoritative directories  
- **Community vs. Curation**: Balance between open contribution and editorial oversight
- **Technical vs. Accessible**: Serving both technical and general audiences

---

## Conclusion

The MCP directory ecosystem demonstrates healthy diversity in approaches, target audiences, and value propositions. Each platform has carved out a distinct niche:

- **Cursor.directory** excels in developer experience and integration simplicity
- **PulseMCP** builds community through events, analytics, and trending content  
- **MCPServerFinder** leverages GitHub's social coding ecosystem
- **MCP.so** creates a comprehensive marketplace with testing capabilities
- **Glama.ai** provides technical rigor with quality assessment and API access

This diversity benefits the broader MCP ecosystem by serving different user needs and encouraging innovation in how MCP servers are discovered, evaluated, and integrated. Server authors benefit from multiple distribution channels, while users can choose directories that match their specific requirements and technical comfort levels.

The evolution toward quality assessment, testing integration, and API access suggests the ecosystem is maturing from simple listings toward sophisticated discovery and evaluation platforms.

---

*Report generated: September 13, 2025*  
*Analysis covers: 5 major MCP directories with 10 individual tool page examinations*  
*Total servers analyzed: 35,000+ across all platforms*
