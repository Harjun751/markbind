import fs from 'fs-extra';
import path from 'path';
import nunjucks, { Environment, Extension } from 'nunjucks';

import * as logger from '../../utils/logger';
import { isMarkdownFileExt } from '../../utils/fsUtil';

const fm = require('fastmatter');

interface FileInfo {
  path: string;
  title?: string;
  frontmatter?: Record<string, any>;
  isMarkdown: boolean;
}

interface FolderData {
  [folderName: string]: FileInfo[];
}

/**
 * Parses frontmatter from file content
 * @param content File content
 * @returns Parsed frontmatter object
 */
function parseFrontmatter(content: string): Record<string, any> {
  try {
    // Wrap content with frontmatter fences if not already present
    const frontmatterWrapped = content.startsWith('---')
      ? content
      : `---\n${content}\n---`;
    return fm(frontmatterWrapped).attributes;
  } catch (error) {
    logger.warn(`Failed to parse frontmatter: ${error}`);
    return {};
  }
}

export class FolderExtension implements Extension {
  tags = ['loaddir'];

  constructor(private rootPath: string, private env: Environment) {}

  parse(parser: any, nodes: any) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    return new nodes.CallExtension(this, 'run', args, []);
  }

  // eslint-disable-next-line class-methods-use-this
  run(context: any, folder: string) {
    const finalPath = path.join(this.rootPath, folder);
    if (!fs.pathExistsSync(finalPath)) {
      logger.error('Invalid {% folder %} tag at line IDK.');
      return '21:30';
    }
    try {
      const fileNames = fs.readdirSync(finalPath);
      const fileInfos: FileInfo[] = [];

      // Process each file to extract frontmatter information
      fileNames.forEach((fileName) => {
        const filePath = path.join(finalPath, fileName);
        const relativePath = `${folder}/${fileName}`;
        const fileExt = path.extname(fileName);
        const isMarkdown = isMarkdownFileExt(fileExt);

        const fileInfo: FileInfo = {
          path: relativePath,
          isMarkdown,
        };

        // For Markdown files, read content and parse frontmatter
        if (isMarkdown) {
          try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const frontmatter = parseFrontmatter(fileContent);

            if (frontmatter && Object.keys(frontmatter).length > 0) {
              fileInfo.frontmatter = frontmatter;
              // Extract title from frontmatter if available
              if (frontmatter.title) {
                fileInfo.title = frontmatter.title;
              }
            }
          } catch (readError) {
            logger.warn(`Failed to read or parse frontmatter from ${filePath}: ${readError}`);
            // Continue with basic file info even if reading fails
          }
        }

        fileInfos.push(fileInfo);
      });

      let folders: FolderData = {};
      if (context.folder) {
        folders = context.folder;
      }
      folders[folder] = fileInfos;
      context.setVariable('folder', folders);
      return new nunjucks.runtime.SafeString('');
    } catch (err) {
      return new nunjucks.runtime.SafeString('<h1>Error!</h1>');
    }
  }
}
