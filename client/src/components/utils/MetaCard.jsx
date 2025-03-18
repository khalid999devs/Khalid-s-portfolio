import { Helmet } from 'react-helmet-async';

function MetaCard({ title, description, image }) {
  return (
    <Helmet>
      <title>{title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'} </title>
      <meta
        name='description'
        content={
          description ||
          'Khalid Ahammed is a dynamic Full Stack Developer with over 4 years of experience in Web and Application Development. Proficient in tech stacks like PERN, MERN, Next.js, and more, he specializes in crafting scalable, high-performance digital solutions. Driven by a passion for leveraging innovative technologies to build impactful websites, web applications, and mobile apps, Khalid thrives in collaborative environments that foster creativity and innovation.'
        }
      />

      {/* Open Graph Meta Tags (Facebook, LinkedIn) */}
      <meta
        property='og:title'
        content={title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'}
      />
      <meta
        property='og:description'
        content={
          description ||
          'Khalid Ahammed is a dynamic Full Stack Developer with over 4 years of experience in Web and Application Development. Proficient in tech stacks like PERN, MERN, Next.js, and more, he specializes in crafting scalable, high-performance digital solutions. Driven by a passion for leveraging innovative technologies to build impactful websites, web applications, and mobile apps, Khalid thrives in collaborative environments that foster creativity and innovation.'
        }
      />
      <meta
        property='og:image'
        content={image || 'https://khalidahammed.com/og-banner.jpg'}
      />
      <meta property='og:url' content={window.location.href} />
      <meta property='og:type' content='website' />

      {/* Twitter Card Meta Tags */}
      <meta name='twitter:card' content='summary_large_image' />
      <meta
        name='twitter:title'
        content={title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'}
      />
      <meta
        name='twitter:description'
        content={
          description ||
          'Khalid Ahammed is a dynamic Full Stack Developer with over 4 years of experience in Web and Application Development. Proficient in tech stacks like PERN, MERN, Next.js, and more, he specializes in crafting scalable, high-performance digital solutions. Driven by a passion for leveraging innovative technologies to build impactful websites, web applications, and mobile apps, Khalid thrives in collaborative environments that foster creativity and innovation.'
        }
      />
      <meta
        name='twitter:image'
        content={image || 'https://khalidahammed.com/og-banner.jpg'}
      />
    </Helmet>
  );
}

export default MetaCard;
