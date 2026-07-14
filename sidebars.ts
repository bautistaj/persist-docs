import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: '📋 Playbook',
      items: ['playbook/index'],
    },
    {
      type: 'category',
      label: '🏗️ Thot',
      items: [
        'thot/prd',
        {
          type: 'category',
          label: 'Arquitectura',
          items: [
            'thot/arquitectura/componentes',
            'thot/arquitectura/secuencias',
            'thot/arquitectura/estados',
          ],
        },
        {
          type: 'category',
          label: 'Base de datos',
          items: ['thot/base-de-datos/esquema'],
        },
      ],
    },
  ],
};

export default sidebars;